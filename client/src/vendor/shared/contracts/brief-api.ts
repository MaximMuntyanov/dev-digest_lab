import { z } from 'zod';

/**
 * PR Why + Risk Brief API contract (L05).
 *
 * Distinct from the older `brief.ts` `PrBrief` ({intent,blast,risks,history}).
 * This is the reviewer-facing "why + risk" card: one structured LLM call over
 * summaries of already-built inputs (intent, blast summary, diff groups, linked
 * issue, project-context specs) — NEVER over raw diff hunks.
 *
 * The model fills only `BriefModelOutput`; the service adds the deterministic
 * meta fields (head_sha, cache/degraded/index flags, sizes) after grounding.
 */

export const RiskLevel = z.enum(['high', 'medium', 'low']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const BriefIndexStatus = z.enum(['full', 'partial', 'degraded', 'failed']);
export type BriefIndexStatus = z.infer<typeof BriefIndexStatus>;

/** A concrete risk pointing at real files from the change set / blast map. */
export const BriefRisk = z.object({
  title: z.string().max(160),
  explanation: z.string().max(600),
  severity: RiskLevel,
  file_refs: z.array(z.string().max(300)).max(8),
});
export type BriefRisk = z.infer<typeof BriefRisk>;

/** "Read these first" — a file (optionally a line) with why it matters. */
export const ReviewFocusItem = z.object({
  file: z.string().max(300),
  line: z.number().int().nullable(),
  reason: z.string().max(300),
});
export type ReviewFocusItem = z.infer<typeof ReviewFocusItem>;

/**
 * The narrow schema the model fills — the ONLY thing the single structured call
 * returns. Bounded arrays/lengths keep output small and cheap.
 */
export const BriefModelOutput = z.object({
  what: z.string().max(800),
  why: z.string().max(800),
  risk_level: RiskLevel,
  risks: z.array(BriefRisk).max(8),
  review_focus: z.array(ReviewFocusItem).max(8),
});
export type BriefModelOutput = z.infer<typeof BriefModelOutput>;

/** The full brief returned to the client = model output + deterministic meta. */
export const Brief = BriefModelOutput.extend({
  /** Head SHA this brief was generated against (cache key part 1). */
  head_sha: z.string(),
  /** ISO timestamp of generation. */
  generated_at: z.string(),
  /** True when served from cache (no LLM call this request). */
  cached: z.boolean(),
  /** True when the repo-intel index was degraded/failed at generation time. */
  degraded: z.boolean(),
  degraded_reason: z.string().nullable(),
  index_status: BriefIndexStatus,
  /** True when there was nothing to brief (no changed files) — UI empty state. */
  empty: z.boolean(),
  /** Assembled model-input size in characters (observability; proves ≤ budget). */
  input_chars: z.number().int(),
});
export type Brief = z.infer<typeof Brief>;
