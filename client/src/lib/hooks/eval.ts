/* hooks/eval.ts — L06 Eval Pipeline.
   Cases are born from accept/dismiss findings; a "run" executes an agent over
   ALL its cases and scores deterministically (recall/precision/citation, no LLM).
   Dashboard + run history + compare read those persisted batches. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  EvalBatchRecord,
  EvalCaseRecord,
  EvalCompare,
  EvalDashboardView,
} from "@devdigest/shared";

const dashboardKey = ["eval", "dashboard"] as const;
const casesKey = (agentId: string | null | undefined) => ["eval", "cases", agentId] as const;
const runsKey = (agentId: string | null | undefined) => ["eval", "runs", agentId] as const;

/** Workspace-wide dashboard: agents with latest metrics + recent runs. */
export function useEvalDashboard() {
  return useQuery({
    queryKey: dashboardKey,
    queryFn: () => api.get<EvalDashboardView>(`/eval/dashboard`),
  });
}

/** All eval cases for an agent, each with its latest per-case result. */
export function useAgentEvalCases(agentId: string | null | undefined) {
  return useQuery({
    queryKey: casesKey(agentId),
    queryFn: () => api.get<EvalCaseRecord[]>(`/agents/${agentId}/eval-cases`),
    enabled: !!agentId,
  });
}

/** Batch-run history for an agent (newest first). */
export function useAgentEvalRuns(agentId: string | null | undefined) {
  return useQuery({
    queryKey: runsKey(agentId),
    queryFn: () => api.get<EvalBatchRecord[]>(`/agents/${agentId}/eval-runs`),
    enabled: !!agentId,
  });
}

/** Compare two batch runs (old prompt vs new). */
export function useEvalCompare(a: string | null | undefined, b: string | null | undefined) {
  return useQuery({
    queryKey: ["eval", "compare", a, b],
    queryFn: () => api.get<EvalCompare>(`/eval/compare?a=${a}&b=${b}`),
    enabled: !!a && !!b,
  });
}

/** Run an agent over ALL its cases and score. Refreshes cases/runs/dashboard. */
export function useRunEvalBatch(agentId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EvalBatchRecord>(`/agents/${agentId}/eval-runs`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: casesKey(agentId) });
      qc.invalidateQueries({ queryKey: runsKey(agentId) });
      qc.invalidateQueries({ queryKey: dashboardKey });
    },
  });
}

/** One-click: turn a finding into an eval case (accepted→must_find, dismissed→must_not_flag). */
export function useCreateEvalCaseFromFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (findingId: string) =>
      api.post<EvalCaseRecord>(`/findings/${findingId}/eval-case`),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: casesKey(created.owner_id) });
      qc.invalidateQueries({ queryKey: dashboardKey });
    },
  });
}

export function useDeleteEvalCase(agentId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => api.del<{ ok: true }>(`/eval/cases/${caseId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: casesKey(agentId) });
      qc.invalidateQueries({ queryKey: dashboardKey });
    },
  });
}
