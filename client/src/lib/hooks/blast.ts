/* hooks/blast.ts — Blast Radius. GET /pulls/:id/blast returns the read-only
   impact map (changed symbols → callers → endpoints) composed from the
   repo-intel index. No LLM; safe to fetch whenever the Blast tab is open. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PrBlast } from "@devdigest/shared";

export function useBlast(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["pr-blast", prId],
    queryFn: () => api.get<PrBlast>(`/pulls/${prId}/blast`),
    enabled: !!prId,
    retry: false,
  });
}
