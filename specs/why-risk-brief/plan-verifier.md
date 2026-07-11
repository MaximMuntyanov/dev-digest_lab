# Plan-Verifier — PR Why + Risk Brief

Final-state verification of the implementation against `spec.md` acceptance
criteria and the `plan.md` traceability matrix (read-only pass over the code).

| AC | Status | Evidence |
|----|--------|----------|
| AC1 assemble sources, no diff hunks | SATISFIED | `service.ts` builds messages from title/author/body, `groups`, `blast`, `issue`, `specs` only; `f.patch` used solely in `collectChangedLines` for line grounding, never sent to the model. |
| AC2 exactly one structured call | SATISFIED | Sole `llm.completeStructured` call site in the module. |
| AC3 ground refs / drop unknown | SATISFIED | `known = changedPaths ∪ blastFiles`; `groundOutput` filters `file_refs` and `review_focus.file` by `known`, keeps `line` only if trusted. |
| AC4 cache hit head_sha+fingerprint | SATISFIED | Returns cached brief only when fingerprint AND head_sha match. Fingerprint = sha256({model,chars,messages}) — no timestamp, so cache genuinely hits. |
| AC5 force bypass + overwrite | SATISFIED | `force` skips cache; upsert guarded by head compare-and-set. |
| AC6 bounded input | SATISFIED | `INPUT_CHAR_BUDGET=24_000` + per-section caps + hard truncation; `input_chars` logged. |
| AC7 color + file:line links | SATISFIED | `riskColors` + `Badge`; review_focus `MonoLink` via `githubBlobUrl(...line)`. |
| AC8 degraded fallback + reason | SATISFIED | try/catch around `getPrBlast` sets degraded/index_status/degraded_reason; surfaced in Brief + banner. |
| AC9 empty, no LLM | SATISFIED | Returns `emptyBrief` before the model call when no changed files; UI empty state. |

## Bugs / gaps
- Minor (recall, not a violation): the prompt's CHANGED FILES list is the union
  of diff-group `top_files` (≤40), so on very large PRs the model sees a subset;
  grounding still uses the full changed set, so no dead links.
- Minor (semantics): `useBrief` uses POST on mount for cache-first load (a POST
  where a GET is semantically expected) — intended so the single generation is
  triggered on first open and reused after.
- Cache correctness confirmed sound (no timestamp/randomness in the fingerprint;
  deterministic inputs). Grounding does not strip everything.

**Result: traceability matrix all-green; no blocking issues.**

## Live verification (manual, against running API)
- Generation on a real PR → grounded risks to real files, `input_chars=8003`.
- 2nd open → `cached:true` in ~36ms (no LLM call).
- `force=true` → `cached:false` (fresh generation).
