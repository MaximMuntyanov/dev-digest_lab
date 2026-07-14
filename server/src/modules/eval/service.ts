import { and, eq } from 'drizzle-orm';
import type { Container } from '../../platform/container.js';
import * as t from '../../db/schema.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import type {
  EvalBatchRecord,
  EvalCaseRecord,
  EvalCompare,
  EvalDashboardView,
  EvalExpectationKind,
  EvalExpectedFinding,
} from '@devdigest/shared';
import { findingContext } from '../reviews/repository/review.repo.js';
import { runEvalBatch, type EvalRunnerCase } from './runner.js';
import * as repo from './repository.js';

type AgentRow = typeof t.agents.$inferSelect;

async function loadAgent(container: Container, workspaceId: string, agentId: string): Promise<AgentRow> {
  const [agent] = await container.db
    .select()
    .from(t.agents)
    .where(and(eq(t.agents.id, agentId), eq(t.agents.workspaceId, workspaceId)));
  if (!agent) throw new NotFoundError('Agent not found');
  return agent;
}

/** Build a unified-diff fragment for a single file from its stored PR patch. */
async function diffForFinding(
  container: Container,
  prId: string,
  file: string,
  startLine: number,
  endLine: number,
): Promise<string> {
  const [row] = await container.db
    .select({ patch: t.prFiles.patch })
    .from(t.prFiles)
    .where(and(eq(t.prFiles.prId, prId), eq(t.prFiles.path, file)));
  if (row?.patch) {
    return `--- a/${file}\n+++ b/${file}\n${row.patch}`;
  }
  // Fallback: synthesize a minimal hunk covering the finding's lines so the
  // grounding gate can anchor to it (used only when the PR patch is unavailable).
  const len = Math.max(1, endLine - startLine + 1);
  const added = Array.from({ length: len }, (_, i) => `+ line ${startLine + i}`).join('\n');
  return `--- a/${file}\n+++ b/${file}\n@@ -${startLine},${len} +${startLine},${len} @@\n${added}`;
}

// ---------------------------------------------------------------- cases

/** AC1/AC2 — one-click: turn a finding into an eval case owned by its agent. */
export async function createCaseFromFinding(
  container: Container,
  workspaceId: string,
  findingId: string,
): Promise<EvalCaseRecord> {
  const ctx = await findingContext(container.db, findingId);
  if (!ctx || ctx.review.workspaceId !== workspaceId) throw new NotFoundError('Finding not found');
  const { finding, review } = ctx;

  const agentId = review.agentId;
  if (!agentId) throw new ValidationError('Finding has no owning agent — cannot build an eval case');

  // accepted → must_find, dismissed → must_not_flag, otherwise default must_find.
  const expectationKind: EvalExpectationKind = finding.acceptedAt
    ? 'must_find'
    : finding.dismissedAt
      ? 'must_not_flag'
      : 'must_find';

  const expected: EvalExpectedFinding = {
    file: finding.file,
    start_line: finding.startLine,
    end_line: finding.endLine,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
  };

  const inputDiff = await diffForFinding(
    container,
    review.prId,
    finding.file,
    finding.startLine,
    finding.endLine,
  );

  const name = `${finding.title}`.slice(0, 80);
  const status = finding.acceptedAt ? 'accepted' : finding.dismissedAt ? 'dismissed' : 'pending';

  const row = await repo.createCase(container.db, {
    workspaceId,
    ownerId: agentId,
    name,
    expectationKind,
    sourceFindingId: findingId,
    inputDiff,
    expectedOutput: expected,
    inputMeta: { finding_id: findingId, from_status: status },
    notes: `Created from finding (${status})`,
  });

  return (await repo.getCaseRow(container.db, workspaceId, row.id).then((r) =>
    r ? toCaseRecordShallow(r) : undefined,
  ))!;
}

function toCaseRecordShallow(row: typeof t.evalCases.$inferSelect): EvalCaseRecord {
  return {
    id: row.id,
    owner_kind: row.ownerKind,
    owner_id: row.ownerId,
    name: row.name,
    expectation_kind: row.expectationKind as EvalExpectationKind,
    source_finding_id: row.sourceFindingId,
    input_diff: row.inputDiff ?? '',
    input_files: row.inputFiles,
    input_meta: row.inputMeta,
    expected_output: (row.expectedOutput as EvalExpectedFinding | null) ?? null,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    last_result: null,
  };
}

export async function listCases(
  container: Container,
  workspaceId: string,
  agentId: string,
): Promise<EvalCaseRecord[]> {
  await loadAgent(container, workspaceId, agentId);
  return repo.listAgentCases(container.db, workspaceId, agentId);
}

export async function deleteCase(
  container: Container,
  workspaceId: string,
  caseId: string,
): Promise<void> {
  const ok = await repo.deleteCase(container.db, workspaceId, caseId);
  if (!ok) throw new NotFoundError('Eval case not found');
}

// ---------------------------------------------------------------- runs

/** AC4/AC5/AC7 — run the agent over all its cases, score, persist a batch. */
export async function runAgentBatch(
  container: Container,
  workspaceId: string,
  agentId: string,
): Promise<EvalBatchRecord> {
  const agent = await loadAgent(container, workspaceId, agentId);
  const rows = await repo.agentCaseRows(container.db, workspaceId, agentId);

  const cases: EvalRunnerCase[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    expectationKind: r.expectationKind as EvalExpectationKind,
    inputDiff: r.inputDiff,
    expected: (r.expectedOutput as EvalExpectedFinding | null) ?? null,
  }));

  const outcome = await runEvalBatch(
    container,
    {
      id: agent.id,
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      strategy: agent.strategy,
      version: agent.version,
    },
    cases,
  );

  const batch = await repo.insertBatch(
    container.db,
    {
      workspaceId,
      ownerId: agentId,
      agentVersion: agent.version,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      casesTotal: outcome.metrics.cases_total,
      passed: outcome.metrics.passed,
      recall: outcome.metrics.recall,
      precision: outcome.metrics.precision,
      citationAccuracy: outcome.metrics.citation_accuracy,
      durationMs: outcome.durationMs,
      costUsd: outcome.costUsd,
    },
    outcome.results,
  );

  const record = await repo.getBatch(container.db, workspaceId, batch.id);
  if (!record) throw new NotFoundError('Batch not found after insert');
  return record;
}

export async function listRuns(
  container: Container,
  workspaceId: string,
  agentId: string,
): Promise<EvalBatchRecord[]> {
  await loadAgent(container, workspaceId, agentId);
  return repo.listAgentBatches(container.db, workspaceId, agentId);
}

export async function getRun(
  container: Container,
  workspaceId: string,
  batchId: string,
): Promise<EvalBatchRecord> {
  const record = await repo.getBatch(container.db, workspaceId, batchId);
  if (!record) throw new NotFoundError('Eval run not found');
  return record;
}

/** AC8 — compare two batch runs side by side (old prompt vs new). */
export async function compareRuns(
  container: Container,
  workspaceId: string,
  a: string,
  b: string,
): Promise<EvalCompare> {
  const [ra, rb] = await Promise.all([getRun(container, workspaceId, a), getRun(container, workspaceId, b)]);
  return { a: ra, b: rb };
}

// ---------------------------------------------------------------- dashboard

/** AC9 — workspace-wide dashboard: agents with latest metrics + recent runs. */
export async function dashboard(container: Container, workspaceId: string): Promise<EvalDashboardView> {
  const [{ agents: latestPerAgent, recent }, caseCounts, agentRows] = await Promise.all([
    repo.dashboardData(container.db, workspaceId),
    repo.caseCountByAgent(container.db, workspaceId),
    container.db
      .select({ id: t.agents.id, name: t.agents.name, model: t.agents.model })
      .from(t.agents)
      .where(eq(t.agents.workspaceId, workspaceId)),
  ]);

  const latestMap = new Map(latestPerAgent.map((a) => [a.agentId, a.latest]));

  const agents = agentRows
    .map((a) => ({
      agent_id: a.id,
      agent_name: a.name,
      model: a.model,
      cases_total: caseCounts.get(a.id) ?? 0,
      latest: latestMap.get(a.id) ?? null,
    }))
    // Show agents that have cases or have been run.
    .filter((a) => a.cases_total > 0 || a.latest);

  return { agents, recent_runs: recent };
}
