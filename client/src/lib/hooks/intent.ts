"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Intent } from "@devdigest/shared";

export interface PrIntentRecord extends Intent {
  pr_id: string;
}

export interface IntentExtractionResult extends Intent {
  pr_id: string;
  _meta: {
    model: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number | null;
  };
}

export function usePrIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: ["intent", prId],
    queryFn: () => api.get<PrIntentRecord>(`/pulls/${prId}/intent`),
    enabled: !!prId,
    retry: false,
  });
}

export function useExtractIntent(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<IntentExtractionResult>(`/pulls/${prId}/intent`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intent", prId] });
    },
  });
}
