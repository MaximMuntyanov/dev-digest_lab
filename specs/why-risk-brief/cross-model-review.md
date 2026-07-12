# Cross-model plan review — PR Why + Risk Brief

- **Reviewer:** GPT (OpenRouter, different model family), staff-engineer role,
  no access to the author's chat — reviewed only `spec.md` + `plan.md` on disk.
- **Reviewee:** implementation-planner plan (`plan.md`).

## Verdict
Directionally feasible, but not implementation-ready as written. Several
guarantees in the spec/plan don't yet match the codebase. Resolutions below are
folded into the implementation.

## Findings (verbatim, GPT)

### P1 — correctness blockers
- "Exactly one LLM call" is not guaranteed: `completeStructured` defaults to
  schema retries → up to 3 provider requests. Define "one" and set retries.
- The 8K limit is not enforceable via per-section char caps (ignores system
  prompt, schema, delimiters, output reserve). Enforce a total assembled-input
  limit with a truncation priority; test the serialized messages.
- T4 contradicts the non-goal: globbing every specs/docs/insights file is not
  "manually attached context" and can leak unrelated context.
- The repo already exports a different `PrBrief` contract stored in
  `pr_brief.json`. Avoid a competing shape without storage semantics.
- Plan claims reuse of PR intent but never calls existing `getIntent`.
- Linked issue is not persisted; needs body parse + live GitHub call → define
  failure fallback.

### P2 — reliability & grounding
- Head-SHA check misses body/issue/context/prompt/model changes → cache an input
  fingerprint alongside SHA.
- Concurrent misses/force can double-generate; late old-head write can clobber →
  single-flight + compare-and-set on head.
- Path-only grounding doesn't validate `review_focus.line` → supply trusted
  symbol/caller lines; keep a line only when verified, else link file only.
- Define path normalization (`./`, renames, case, encoding; whether blast files
  include downstream caller files).
- Wrap blast/index reads with a failure boundary; add `degraded_reason`.
- Define exactly which index statuses set `degraded` (`partial` vs healthy).
- Empty-state should reconcile `pr_files.length`.

### P3 — implementation quality
- Prompt-injection delimiters for untrusted PR body/issue/specs.
- Bound schema arrays/lengths; set output-token/timeout limits.
- Concrete rate limits + error contracts.
- Expand tests: zero/one call, retries off, cache hit/force/race, SHA move,
  token bound, grounding, degraded exceptions, client empty/error/loading.

## Author resolutions (folded into implementation)

| Finding | Resolution |
|---|---|
| One call guarantee | One `completeStructured` invocation with `maxRetries: 1` (one repair max); logged input size proves a single generation. |
| 8K budget | Single total char budget (~24k chars) over the whole assembled user message, with section truncation priority (issue → specs → diff groups → blast). Input size logged. (AC6) |
| Context reader leak | Scoped to the repo's own `specs/**/*.md`, repo-relative, hard-capped, wrapped in untrusted delimiters + injection guard. Documented as the MVP stand-in until Context Folder attach metadata exists. |
| Contract collision | New contract lives in `brief-api.ts` as `Brief` (distinct from `brief.ts` `PrBrief`); cached under a versioned key `{ v: 2, brief, head_sha, fingerprint }` in `pr_brief.json`. |
| Intent reuse | Reuse deterministic PR title/body/linked issue as intent input (spec Non-goal: no extra intent LLM call); `getIntent` used opportunistically if present. |
| Linked issue | Best-effort: parse `#\d+` from body + live `getIssue`, wrapped in try/catch; failure → section omitted. |
| Cache fingerprint | Cache key = `head_sha` + sha256 of assembled input; hit only when both match (addresses body/issue/context/model drift). |
| Grounding lines | `review_focus.line` kept only if it matches a trusted blast caller line for that file; otherwise the line is dropped and the file linked without an anchor. Paths normalized (strip `./`) and grounded against changed files ∪ blast files (incl. caller files). |
| degraded_reason | Added to the `Brief` contract; blast/index reads wrapped in try/catch → on throw, deterministic fallback brief with `degraded=true`. |
| Bounds | zod `.max()` on `what/why` length and on `risks`/`review_focus`/`file_refs` array sizes; output token cap + timeout on the call. |
| Injection | Untrusted sections delimiter-wrapped with a guard line, following the reviewer-core pattern. |
