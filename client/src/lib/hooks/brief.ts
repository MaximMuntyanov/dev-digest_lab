/* hooks/brief.ts — PR Why+Risk Brief. POST /pulls/:id/brief assembles a small
   input from already-built pieces and makes ONE structured LLM call, cached
   per-PR. Opening the card loads cache-first (no LLM when a valid cache exists);
   the Regenerate button forces a fresh call. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Brief } from "@devdigest/shared";

const briefKey = (prId: string | null | undefined) => ["pr-brief", prId] as const;

/** Load the brief (cache-first). The server returns a cached brief with NO LLM
    call when head SHA + input fingerprint are unchanged. */
export function useBrief(prId: string | null | undefined) {
  return useQuery({
    queryKey: briefKey(prId),
    queryFn: () => api.post<Brief>(`/pulls/${prId}/brief`),
    enabled: !!prId,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Force a fresh brief (bypasses cache → exactly one LLM call). */
export function useGenerateBrief(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Brief>(`/pulls/${prId}/brief?force=true`),
    onSuccess: (data) => qc.setQueryData(briefKey(prId), data),
  });
}
