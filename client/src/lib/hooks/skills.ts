/* hooks/skills.ts — Skills Lab: CRUD for reusable rubric skills + skill-scoped
   evals (cases / batch runs), mirroring hooks/agents.ts + hooks/eval.ts.
   Skill eval runs inject the skill body over a base reviewer and score in code. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { EvalBatchRecord, EvalCaseRecord, Skill } from "@devdigest/shared";

const skillsKey = ["skills"] as const;
const skillKey = (id: string | null | undefined) => ["skill", id] as const;
const skillCasesKey = (id: string | null | undefined) => ["eval", "skill-cases", id] as const;
const skillRunsKey = (id: string | null | undefined) => ["eval", "skill-runs", id] as const;

// ---------------------------------------------------------------- CRUD

export function useSkills() {
  return useQuery({ queryKey: skillsKey, queryFn: () => api.get<Skill[]>("/skills") });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: skillKey(id),
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: Skill["type"];
  body: string;
  enabled?: boolean;
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: skillsKey }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<Pick<Skill, "name" | "description" | "type" | "body" | "enabled">>;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: skillsKey });
      qc.setQueryData(skillKey(data.id), data);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: skillsKey });
      qc.removeQueries({ queryKey: skillKey(id) });
    },
  });
}

// ---------------------------------------------------------------- evals

export function useSkillEvalCases(skillId: string | null | undefined) {
  return useQuery({
    queryKey: skillCasesKey(skillId),
    queryFn: () => api.get<EvalCaseRecord[]>(`/skills/${skillId}/eval-cases`),
    enabled: !!skillId,
  });
}

export function useSkillEvalRuns(skillId: string | null | undefined) {
  return useQuery({
    queryKey: skillRunsKey(skillId),
    queryFn: () => api.get<EvalBatchRecord[]>(`/skills/${skillId}/eval-runs`),
    enabled: !!skillId,
  });
}

export interface CreateSkillEvalCaseInput {
  name: string;
  input_diff: string;
  expectation_kind: "must_find" | "must_not_flag";
  expected?: {
    file: string;
    start_line: number;
    end_line: number;
    severity?: string | null;
    category?: string | null;
    title?: string | null;
  } | null;
}

export function useCreateSkillEvalCase(skillId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillEvalCaseInput) =>
      api.post<EvalCaseRecord>(`/skills/${skillId}/eval-cases`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: skillCasesKey(skillId) }),
  });
}

export function useRunSkillEvalBatch(skillId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EvalBatchRecord>(`/skills/${skillId}/eval-runs`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: skillCasesKey(skillId) });
      qc.invalidateQueries({ queryKey: skillRunsKey(skillId) });
    },
  });
}

/** Delete a skill eval case (shares the generic /eval/cases/:id endpoint). */
export function useDeleteSkillEvalCase(skillId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => api.del<{ ok: true }>(`/eval/cases/${caseId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: skillCasesKey(skillId) }),
  });
}
