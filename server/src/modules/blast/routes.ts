import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import type { PrBlast } from '@devdigest/shared';
import * as t from '../../db/schema.js';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { getPrBlast } from './service.js';

/**
 * Blast Radius module — the "what can these changes break?" map for a PR.
 *
 *   GET /pulls/:id/blast → PrBlast (changed symbols → callers → endpoints)
 *
 * The route only reads: it resolves the PR's changed files, then hands them to
 * the service which reads the repo-intel index through the `repoIntel` facade.
 * No index writes and no LLM.
 */
export default async function blastRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/blast',
    { schema: { params: IdParams } },
    async (req): Promise<PrBlast> => {
      const { workspaceId } = await getContext(container, req);

      const [pr] = await container.db
        .select()
        .from(t.pullRequests)
        .where(
          and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, req.params.id)),
        );
      if (!pr) throw new NotFoundError('Pull request not found');

      const files = await container.db
        .select({ path: t.prFiles.path })
        .from(t.prFiles)
        .where(eq(t.prFiles.prId, pr.id));

      return getPrBlast(container, pr.repoId, files.map((f) => f.path));
    },
  );
}
