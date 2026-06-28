import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { ConventionsService } from './service.js';

/**
 * Conventions module — extract and manage coding convention candidates.
 *   GET  /repos/:id/conventions            → list candidates
 *   POST /repos/:id/conventions/extract    → run extraction
 *   PUT  /conventions/:id                  → update candidate (accept/reject/edit)
 *   POST /conventions/create-skill         → create skill from accepted conventions
 */

const UpdateConventionBody = z.object({
  rule: z.string().optional(),
  evidence_path: z.string().optional(),
  evidence_snippet: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  accepted: z.boolean().optional(),
});

const CreateSkillFromConventionsBody = z.object({
  repo_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const candidates = await service.extract(workspaceId, req.params.id);
      reply.status(201);
      return candidates;
    },
  );

  app.put(
    '/conventions/:id',
    { schema: { params: IdParams, body: UpdateConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const candidate = await service.updateCandidate(workspaceId, req.params.id, req.body);
      if (!candidate) throw new NotFoundError('Convention not found');
      return candidate;
    },
  );

  app.post(
    '/conventions/create-skill',
    { schema: { body: CreateSkillFromConventionsBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const body = req.body;
      const skill = await service.createSkillFromAccepted(
        workspaceId,
        body.repo_id,
        body.name,
        body.description,
      );
      reply.status(201);
      return skill;
    },
  );
}
