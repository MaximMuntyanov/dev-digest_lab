import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Brief } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { getPrBrief } from './service.js';

/**
 * PR Why + Risk Brief module.
 *
 *   POST /pulls/:id/brief[?force=true] → Brief
 *
 * Assembles a small input from already-built pieces and makes exactly ONE
 * structured LLM call (cached per-PR). `force=true` bypasses the cache and
 * regenerates. Rate-limited because it is the only LLM-calling route here.
 */
export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.post(
    '/pulls/:id/brief',
    {
      schema: {
        params: IdParams,
        querystring: z.object({ force: z.coerce.boolean().optional() }),
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req): Promise<Brief> => {
      const { workspaceId } = await getContext(container, req);
      const brief = await getPrBrief(container, workspaceId, req.params.id, {
        force: req.query.force ?? false,
      });
      // Observability: proves one-or-zero calls + input size ≤ budget.
      req.log.info(
        {
          prId: req.params.id,
          cached: brief.cached,
          empty: brief.empty,
          degraded: brief.degraded,
          input_chars: brief.input_chars,
        },
        'pr brief',
      );
      return brief;
    },
  );
}
