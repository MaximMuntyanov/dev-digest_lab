import { z } from 'zod';

/**
 * Blast Radius API contract — response of `GET /pulls/:id/blast`.
 *
 * The whole feature is READ-ONLY over the repo-intel index (no LLM, no parsing
 * at request time): the server composes this shape from `repoIntel.getBlastRadius`
 * + `repoIntel.getIndexState`. Snake_case transport, distinct from the PR-Brief
 * `BlastRadius` (LLM output) in `brief.ts`.
 */

export const BlastIndexStatus = z.enum(['full', 'partial', 'degraded', 'failed']);
export type BlastIndexStatus = z.infer<typeof BlastIndexStatus>;

/** A symbol declared in a changed file (function/class/export). */
export const BlastChangedSymbol = z.object({
  file: z.string(),
  name: z.string(),
  kind: z.string(),
});
export type BlastChangedSymbol = z.infer<typeof BlastChangedSymbol>;

/** One caller (file:line) that reaches a changed symbol. */
export const BlastCallerRow = z.object({
  file: z.string(),
  /** Enclosing symbol of the caller (where the call happens). */
  symbol: z.string(),
  /** Which changed symbol this caller reaches. */
  via_symbol: z.string(),
  /** 1-based line of the reference — used for the click-to-code deep link. */
  line: z.number().int(),
  /** file_rank of the caller file (higher = more depended-on). */
  rank: z.number(),
});
export type BlastCallerRow = z.infer<typeof BlastCallerRow>;

/** A changed symbol together with its (rank-sorted) callers. */
export const BlastSymbolGroup = z.object({
  file: z.string(),
  name: z.string(),
  kind: z.string(),
  callers: z.array(BlastCallerRow),
});
export type BlastSymbolGroup = z.infer<typeof BlastSymbolGroup>;

export const PrBlast = z.object({
  /** Index freshness — drives the partial/degraded badge. */
  index_status: BlastIndexStatus,
  /** True when the map is best-effort (index degraded/failed or ripgrep fallback). */
  degraded: z.boolean(),
  /** Why it's degraded/empty (e.g. 'no_data', 'index_partial'); null when clean. */
  reason: z.string().nullable(),
  changed_symbols: z.array(BlastChangedSymbol),
  /** Changed symbols grouped with their callers (levels: symbol → callers). */
  symbols: z.array(BlastSymbolGroup),
  /** Impacted HTTP endpoints ("METHOD /path") reachable from the changed files. */
  endpoints: z.array(z.string()),
  /** Impacted cron/scheduled jobs. */
  crons: z.array(z.string()),
  counts: z.object({
    symbols: z.number().int(),
    callers: z.number().int(),
    endpoints: z.number().int(),
    crons: z.number().int(),
  }),
});
export type PrBlast = z.infer<typeof PrBlast>;
