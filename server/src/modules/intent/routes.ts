import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { IntentService } from './service.js';

/**
 * Intent Layer module — cheap-model PR intent classification.
 *
 *   GET  /pulls/:id/intent           → persisted Intent (or 404)
 *   POST /pulls/:id/intent           → (re)extract intent via flash model
 *   POST /pulls/:id/intent { body }  → optional provider/model override
 */
export default async function intentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new IntentService(container);

  app.get(
    '/pulls/:id/intent',
    { schema: { params: IdParams } },
    async (req) => {
      await getContext(container, req);
      const intent = await service.getIntent(req.params.id);
      if (!intent) throw new NotFoundError('Intent not computed yet');
      return { pr_id: req.params.id, ...intent };
    },
  );

  const ExtractBody = z
    .object({
      provider: z.enum(['openai', 'anthropic', 'openrouter']).optional(),
      model: z.string().optional(),
    })
    .optional();

  app.post(
    '/pulls/:id/intent',
    {
      schema: { params: IdParams },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      const body = ExtractBody.parse(req.body ?? {});

      const [pr] = await container.db
        .select()
        .from(t.pullRequests)
        .where(
          and(
            eq(t.pullRequests.workspaceId, workspaceId),
            eq(t.pullRequests.id, req.params.id),
          ),
        );
      if (!pr) throw new NotFoundError('Pull request not found');

      const files = await container.db
        .select()
        .from(t.prFiles)
        .where(eq(t.prFiles.prId, pr.id));

      // Attempt to resolve linked issue from body (e.g. "Fixes #123")
      let linked_issue: { title: string; body: string | null } | null = null;
      if (pr.body) {
        const issueMatch = pr.body.match(
          /(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/i,
        );
        if (issueMatch) {
          try {
            const [repo] = await container.db
              .select()
              .from(t.repos)
              .where(eq(t.repos.id, pr.repoId));
            if (repo) {
              const gh = await container.github();
              const issue = await gh.getIssue(
                { owner: repo.owner, name: repo.name },
                Number(issueMatch[1]),
              );
              linked_issue = { title: issue.title, body: issue.body ?? null };
            }
          } catch {
            // GitHub unavailable — proceed without linked issue
          }
        }
      }

      const prFiles = files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      }));

      req.log.info(
        {
          prId: pr.id,
          filesCount: prFiles.length,
          hasBody: !!pr.body?.trim(),
          hasLinkedIssue: !!linked_issue,
        },
        'intent: extracting PR intent (cheap model, no code bodies)',
      );

      const result = await service.extractIntent(
        pr.id,
        { title: pr.title, body: pr.body, linked_issue, files: prFiles },
        body,
      );

      req.log.info(
        {
          prId: pr.id,
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          costUsd: result.costUsd,
        },
        'intent: extraction complete',
      );

      return {
        pr_id: pr.id,
        ...result.intent,
        _meta: {
          model: result.model,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          cost_usd: result.costUsd,
        },
      };
    },
  );
}
