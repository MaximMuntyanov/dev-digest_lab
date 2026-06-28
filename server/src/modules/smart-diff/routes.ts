import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { buildSmartDiff } from './service.js';

/**
 * Smart Diff module — deterministic file classification + findings overlay.
 * Zero LLM calls; composes PR files + persisted findings into SmartDiff groups.
 *
 *   GET /pulls/:id/smart-diff → SmartDiffResponse
 */
export default async function smartDiffRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/smart-diff',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);

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

      // Gather findings from the latest review (if any)
      const latestReview = await container.db
        .select()
        .from(t.reviews)
        .where(and(eq(t.reviews.prId, pr.id), eq(t.reviews.kind, 'review')))
        .orderBy(desc(t.reviews.createdAt))
        .limit(1);

      let findings: { file: string; start_line: number; end_line: number }[] = [];
      if (latestReview.length > 0) {
        const findingRows = await container.db
          .select({
            file: t.findings.file,
            startLine: t.findings.startLine,
            endLine: t.findings.endLine,
          })
          .from(t.findings)
          .where(eq(t.findings.reviewId, latestReview[0]!.id));

        findings = findingRows.map((f) => ({
          file: f.file,
          start_line: f.startLine,
          end_line: f.endLine,
        }));
      }

      return buildSmartDiff(
        files.map((f) => ({
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
        })),
        findings,
      );
    },
  );
}
