import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import type { SpecFile, IndexStatus } from '@devdigest/shared';
import * as t from '../../db/schema.js';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { listContextFiles } from './reader.js';

/**
 * Project Context module (L05 — Context Folder).
 *
 *   GET  /repos/:id/context          → SpecFile[] : every markdown under
 *                                      specs/docs/insights (any depth) in the clone.
 *   POST /repos/:id/context/reindex  → IndexStatus : re-scan the clone (no LLM).
 *
 * Read-only over the filesystem clone — no index writes, no model calls. Bodies
 * are streamed to the client for Preview; attaching paths to an agent is done via
 * the agents module (`context_paths`), and injection into the prompt happens in
 * the run-executor's `## Project context` slot.
 */
export default async function contextRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  async function resolveCloneRoot(workspaceId: string, id: string): Promise<string> {
    const [repo] = await container.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, id)));
    if (!repo) throw new NotFoundError('Repo not found');
    return repo.clonePath ?? container.git.clonePathFor({ owner: repo.owner, name: repo.name });
  }

  app.get(
    '/repos/:id/context',
    { schema: { params: IdParams } },
    async (req): Promise<SpecFile[]> => {
      const { workspaceId } = await getContext(container, req);
      const cloneRoot = await resolveCloneRoot(workspaceId, req.params.id);
      const files = await listContextFiles(cloneRoot, { withContent: true });
      return files.map((f) => ({
        path: f.path,
        size: f.size,
        updated_at: f.updatedAt,
        ...(f.content !== undefined ? { content: f.content } : {}),
      }));
    },
  );

  app.post(
    '/repos/:id/context/reindex',
    { schema: { params: IdParams } },
    async (req): Promise<IndexStatus> => {
      const { workspaceId } = await getContext(container, req);
      try {
        const cloneRoot = await resolveCloneRoot(workspaceId, req.params.id);
        const files = await listContextFiles(cloneRoot, { withContent: false });
        return { status: 'done', pct: 100, chunks_indexed: files.length };
      } catch {
        return { status: 'error', pct: 0, message: 'no clone available' };
      }
    },
  );
}
