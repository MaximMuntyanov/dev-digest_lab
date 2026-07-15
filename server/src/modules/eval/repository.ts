import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type {
  EvalBatchRecord,
  EvalCasePerResult,
  EvalCaseRecord,
  EvalExpectationKind,
  EvalExpectedFinding,
} from '@devdigest/shared';

type CaseRow = typeof t.evalCases.$inferSelect;
type BatchRow = typeof t.evalBatches.$inferSelect;

// ---------------------------------------------------------------- mappers

function caseToRecord(row: CaseRow, lastResult: EvalCasePerResult | null): EvalCaseRecord {
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
    last_result: lastResult,
  };
}

function batchToRecord(row: BatchRow, results?: EvalCasePerResult[]): EvalBatchRecord {
  return {
    id: row.id,
    owner_kind: row.ownerKind,
    owner_id: row.ownerId,
    agent_version: row.agentVersion,
    model: row.model,
    system_prompt: row.systemPrompt,
    ran_at: row.ranAt.toISOString(),
    cases_total: row.casesTotal,
    passed: row.passed,
    recall: row.recall,
    precision: row.precision,
    citation_accuracy: row.citationAccuracy,
    duration_ms: row.durationMs,
    cost_usd: row.costUsd,
    ...(results ? { results } : {}),
  };
}

// ---------------------------------------------------------------- cases

export interface CreateCaseInput {
  workspaceId: string;
  ownerKind?: 'skill' | 'agent';
  ownerId: string;
  name: string;
  expectationKind: EvalExpectationKind;
  sourceFindingId?: string | null;
  inputDiff: string;
  expectedOutput: EvalExpectedFinding | null;
  inputMeta?: unknown;
  notes?: string | null;
}

export async function createCase(db: Db, input: CreateCaseInput): Promise<CaseRow> {
  const [row] = await db
    .insert(t.evalCases)
    .values({
      workspaceId: input.workspaceId,
      ownerKind: input.ownerKind ?? 'agent',
      ownerId: input.ownerId,
      name: input.name,
      expectationKind: input.expectationKind,
      sourceFindingId: input.sourceFindingId ?? null,
      inputDiff: input.inputDiff,
      inputMeta: input.inputMeta ?? null,
      expectedOutput: input.expectedOutput ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new Error('Failed to insert eval case');
  return row;
}

export async function getCaseRow(
  db: Db,
  workspaceId: string,
  caseId: string,
): Promise<CaseRow | undefined> {
  const [row] = await db
    .select()
    .from(t.evalCases)
    .where(and(eq(t.evalCases.id, caseId), eq(t.evalCases.workspaceId, workspaceId)));
  return row;
}

export async function deleteCase(db: Db, workspaceId: string, caseId: string): Promise<boolean> {
  const rows = await db
    .delete(t.evalCases)
    .where(and(eq(t.evalCases.id, caseId), eq(t.evalCases.workspaceId, workspaceId)))
    .returning({ id: t.evalCases.id });
  return rows.length > 0;
}

/** All cases owned by (ownerKind, ownerId), each with its latest per-case result. */
export async function listCasesByOwner(
  db: Db,
  workspaceId: string,
  ownerId: string,
  ownerKind: 'skill' | 'agent' = 'agent',
): Promise<EvalCaseRecord[]> {
  const rows = await db
    .select()
    .from(t.evalCases)
    .where(
      and(
        eq(t.evalCases.workspaceId, workspaceId),
        eq(t.evalCases.ownerKind, ownerKind),
        eq(t.evalCases.ownerId, ownerId),
      ),
    )
    .orderBy(desc(t.evalCases.createdAt));

  const latest = await latestResultByCase(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => caseToRecord(r, latest.get(r.id) ?? null));
}

/** Bare case rows for the runner (no per-case-result join). */
export async function caseRowsByOwner(
  db: Db,
  workspaceId: string,
  ownerId: string,
  ownerKind: 'skill' | 'agent' = 'agent',
): Promise<CaseRow[]> {
  return db
    .select()
    .from(t.evalCases)
    .where(
      and(
        eq(t.evalCases.workspaceId, workspaceId),
        eq(t.evalCases.ownerKind, ownerKind),
        eq(t.evalCases.ownerId, ownerId),
      ),
    )
    .orderBy(desc(t.evalCases.createdAt));
}

/** All cases owned by an agent (back-compat wrapper). */
export const listAgentCases = (db: Db, workspaceId: string, agentId: string) =>
  listCasesByOwner(db, workspaceId, agentId, 'agent');

/** Bare agent case rows for the runner (back-compat wrapper). */
export const agentCaseRows = (db: Db, workspaceId: string, agentId: string) =>
  caseRowsByOwner(db, workspaceId, agentId, 'agent');

/** Map of caseId → latest per-case result (from the newest batch that ran it). */
async function latestResultByCase(
  db: Db,
  caseIds: string[],
): Promise<Map<string, EvalCasePerResult>> {
  const out = new Map<string, EvalCasePerResult>();
  if (caseIds.length === 0) return out;
  const runs = await db
    .select()
    .from(t.evalRuns)
    .where(inArray(t.evalRuns.caseId, caseIds))
    .orderBy(desc(t.evalRuns.ranAt));
  for (const run of runs) {
    if (out.has(run.caseId)) continue;
    if (run.actualOutput) out.set(run.caseId, run.actualOutput as EvalCasePerResult);
  }
  return out;
}

// ---------------------------------------------------------------- batches

export interface InsertBatchInput {
  workspaceId: string;
  ownerKind?: 'skill' | 'agent';
  ownerId: string;
  agentVersion: number;
  model: string;
  systemPrompt: string;
  casesTotal: number;
  passed: number;
  recall: number;
  precision: number;
  citationAccuracy: number;
  durationMs: number;
  costUsd: number | null;
}

/** Persist a batch header + one per-case row per result (atomic-ish, best-effort). */
export async function insertBatch(
  db: Db,
  header: InsertBatchInput,
  results: EvalCasePerResult[],
): Promise<BatchRow> {
  const [batch] = await db
    .insert(t.evalBatches)
    .values({
      workspaceId: header.workspaceId,
      ownerKind: header.ownerKind ?? 'agent',
      ownerId: header.ownerId,
      agentVersion: header.agentVersion,
      model: header.model,
      systemPrompt: header.systemPrompt,
      casesTotal: header.casesTotal,
      passed: header.passed,
      recall: header.recall,
      precision: header.precision,
      citationAccuracy: header.citationAccuracy,
      durationMs: header.durationMs,
      costUsd: header.costUsd,
    })
    .returning();
  if (!batch) throw new Error('Failed to insert eval batch');

  if (results.length > 0) {
    await db.insert(t.evalRuns).values(
      results.map((r) => ({
        caseId: r.case_id,
        batchId: batch.id,
        actualOutput: r as unknown,
        pass: r.pass,
      })),
    );
  }
  return batch;
}

/** Batch history for an agent (headers only, newest first). */
export async function listAgentBatches(
  db: Db,
  workspaceId: string,
  agentId: string,
  limit = 20,
): Promise<EvalBatchRecord[]> {
  const rows = await db
    .select()
    .from(t.evalBatches)
    .where(and(eq(t.evalBatches.workspaceId, workspaceId), eq(t.evalBatches.ownerId, agentId)))
    .orderBy(desc(t.evalBatches.ranAt))
    .limit(limit);
  return rows.map((r) => batchToRecord(r));
}

/** A single batch with its per-case results. */
export async function getBatch(
  db: Db,
  workspaceId: string,
  batchId: string,
): Promise<EvalBatchRecord | undefined> {
  const [row] = await db
    .select()
    .from(t.evalBatches)
    .where(and(eq(t.evalBatches.id, batchId), eq(t.evalBatches.workspaceId, workspaceId)));
  if (!row) return undefined;
  const runs = await db.select().from(t.evalRuns).where(eq(t.evalRuns.batchId, batchId));
  const results = runs
    .map((run) => run.actualOutput as EvalCasePerResult | null)
    .filter((r): r is EvalCasePerResult => !!r);
  return batchToRecord(row, results);
}

// ---------------------------------------------------------------- dashboard

/** Latest batch per agent + most-recent runs across the workspace. */
export async function dashboardData(
  db: Db,
  workspaceId: string,
): Promise<{ agents: { agentId: string; latest: EvalBatchRecord | null }[]; recent: EvalBatchRecord[] }> {
  const rows = await db
    .select()
    .from(t.evalBatches)
    .where(eq(t.evalBatches.workspaceId, workspaceId))
    .orderBy(desc(t.evalBatches.ranAt));

  const latestByAgent = new Map<string, EvalBatchRecord>();
  for (const row of rows) {
    if (!latestByAgent.has(row.ownerId)) latestByAgent.set(row.ownerId, batchToRecord(row));
  }
  return {
    agents: [...latestByAgent.entries()].map(([agentId, latest]) => ({ agentId, latest })),
    recent: rows.slice(0, 12).map((r) => batchToRecord(r)),
  };
}

/** Count of cases per agent (for the dashboard rows). */
export async function caseCountByAgent(
  db: Db,
  workspaceId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ ownerId: t.evalCases.ownerId })
    .from(t.evalCases)
    .where(and(eq(t.evalCases.workspaceId, workspaceId), eq(t.evalCases.ownerKind, 'agent')));
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.ownerId, (out.get(r.ownerId) ?? 0) + 1);
  return out;
}
