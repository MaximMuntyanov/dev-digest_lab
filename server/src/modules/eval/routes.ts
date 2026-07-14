import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type {
  EvalBatchRecord,
  EvalCaseRecord,
  EvalCompare,
  EvalDashboardView,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import * as service from './service.js';

/**
 * Eval Pipeline module (L06).
 *
 *   POST   /findings/:id/eval-case        → EvalCaseRecord  (one-click from a finding)
 *   GET    /agents/:id/eval-cases         → EvalCaseRecord[]
 *   DELETE /eval/cases/:id                → { ok: true }
 *   POST   /agents/:id/eval-runs          → EvalBatchRecord (run agent over all cases)
 *   GET    /agents/:id/eval-runs          → EvalBatchRecord[] (history)
 *   GET    /eval/runs/:id                 → EvalBatchRecord (with per-case results)
 *   GET    /eval/compare?a=&b=            → EvalCompare
 *   GET    /eval/dashboard                → EvalDashboardView
 *
 * Scoring is deterministic (file + line overlap) — no LLM call in the scorer.
 */
export default async function evalRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  // AC1/AC2 — turn a finding into an eval case.
  app.post(
    '/findings/:id/eval-case',
    { schema: { params: IdParams } },
    async (req): Promise<EvalCaseRecord> => {
      const { workspaceId } = await getContext(container, req);
      return service.createCaseFromFinding(container, workspaceId, req.params.id);
    },
  );

  // AC3 — all cases for an agent (with each case's latest result).
  app.get(
    '/agents/:id/eval-cases',
    { schema: { params: IdParams } },
    async (req): Promise<EvalCaseRecord[]> => {
      const { workspaceId } = await getContext(container, req);
      return service.listCases(container, workspaceId, req.params.id);
    },
  );

  app.delete(
    '/eval/cases/:id',
    { schema: { params: IdParams } },
    async (req): Promise<{ ok: true }> => {
      const { workspaceId } = await getContext(container, req);
      await service.deleteCase(container, workspaceId, req.params.id);
      return { ok: true };
    },
  );

  // AC4/AC5/AC7 — run the agent over all its cases and score.
  app.post(
    '/agents/:id/eval-runs',
    {
      schema: { params: IdParams },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req): Promise<EvalBatchRecord> => {
      const { workspaceId } = await getContext(container, req);
      const batch = await service.runAgentBatch(container, workspaceId, req.params.id);
      req.log.info(
        {
          agentId: req.params.id,
          cases_total: batch.cases_total,
          passed: batch.passed,
          recall: batch.recall,
          precision: batch.precision,
          citation_accuracy: batch.citation_accuracy,
          scoring: 'code-only',
        },
        'eval batch',
      );
      return batch;
    },
  );

  // AC8 — run history.
  app.get(
    '/agents/:id/eval-runs',
    { schema: { params: IdParams } },
    async (req): Promise<EvalBatchRecord[]> => {
      const { workspaceId } = await getContext(container, req);
      return service.listRuns(container, workspaceId, req.params.id);
    },
  );

  app.get(
    '/eval/runs/:id',
    { schema: { params: IdParams } },
    async (req): Promise<EvalBatchRecord> => {
      const { workspaceId } = await getContext(container, req);
      return service.getRun(container, workspaceId, req.params.id);
    },
  );

  // AC8 — compare two runs (old prompt vs new).
  app.get(
    '/eval/compare',
    { schema: { querystring: z.object({ a: z.string().uuid(), b: z.string().uuid() }) } },
    async (req): Promise<EvalCompare> => {
      const { workspaceId } = await getContext(container, req);
      return service.compareRuns(container, workspaceId, req.query.a, req.query.b);
    },
  );

  // AC9 — workspace-wide dashboard.
  app.get('/eval/dashboard', async (req): Promise<EvalDashboardView> => {
    const { workspaceId } = await getContext(container, req);
    return service.dashboard(container, workspaceId);
  });
}
