# Implementation Plan — PR Why + Risk Brief

- **Consumes:** `specs/why-risk-brief/spec.md` (approved)
- **Produced by:** implementation-planner (SDD)
- **Rule:** this plan answers *how & in what order*; *what & why* live in the spec.
  Every task references the AC-IDs it satisfies (traceability matrix at the end).

---

## 0. Reuse map (why this feature is almost free)

| Need | Existing building block | File |
|---|---|---|
| Blast summary | `getPrBlast` → `counts`, `endpoints`, `symbols` | `server/src/modules/blast/service.ts` |
| Structured LLM call | `llm.completeStructured({schema,schemaName,messages})` | `reviewer-core` (pattern `review/run.ts:174`) |
| Per-feature model | `resolveFeatureModel(ws,'risk_brief')` | `server/src/modules/settings/feature-models.ts` |
| Cache table | `pr_brief` (jsonb by pr_id) | `server/src/db/schema/reviews.ts:57` |
| File rank (core-ness) | `repoIntel.getFileRank(repoId, paths)` | `server/src/modules/repo-intel/repository.ts` |
| Linked issue | `github().getIssue` / `PrDetail.linked_issue` | `server/src/adapters/github/octokit.ts` |
| Route/tenancy conventions | `getContext`, `IdParams`, ZodTypeProvider | `blast/routes.ts` (template) |
| Client fetch hook + card | `useBlast` + `BlastTab` | `client/src/lib/hooks/blast.ts`, `.../BlastTab` |

---

## 1. Tasks (ordered)

### T1 — `Brief` contract (server + client vendored)  → AC2, AC3, AC7, AC8, AC9
- Add `contracts/brief-api.ts` with `RiskLevel`, `BriefRisk`, `ReviewFocusItem`,
  `Brief`, and a narrow `BriefModelOutput` (only the model-produced fields:
  `what, why, risk_level, risks[], review_focus[]`) used as the `completeStructured`
  schema. Meta fields (`head_sha`, `cached`, `degraded`, `index_status`, `empty`,
  `generated_at`) are added deterministically by the service, NOT by the model.
- Export from both shared barrels. Mirror the file into the client vendor copy.

### T2 — `pr_brief` repo helpers  → AC4, AC5
- Add `getBrief(db, prId)` / `upsertBrief(db, prId, json)` mirroring
  `getIntent`/`upsertIntent`. Store `{ brief, head_sha, generated_at }` in `json`.

### T3 — Deterministic diff-group stats  → AC1, AC6
- `server/src/modules/brief/diff-groups.ts`: classify each `pr_files` row into
  `core | wiring | boilerplate` using `repoIntel.getFileRank` percentile + path
  heuristics (lockfiles/generated → boilerplate; index/config/route wiring →
  wiring; high-rank source → core). Return per-group counts + additions/deletions.
  Pure, no LLM.

### T4 — Project-context reader  → AC1
- `server/src/modules/brief/context-reader.ts`: read attached spec markdown
  (Context Folder). MVP: glob `**/{specs,docs,insights}/**/*.md` under the repo
  root config, cap total chars. (Manual attach metadata is future; MVP reads the
  configured roots.)

### T5 — Brief service (assemble + ONE call + cache + grounding)  → AC1..AC6, AC8, AC9
- `server/src/modules/brief/service.ts` `getPrBrief(container, ws, prId, {force})`:
  1. load PR row; if no changed files → return `empty` (AC9).
  2. cache: if `!force` and stored `head_sha === pr.headSha` → return cached (AC4).
  3. assemble input (AC1): PR title/body/author, linked issue, blast summary via
     `getPrBlast`, diff-group stats (T3), context specs (T4). **No diff hunks.**
     Enforce char budget per section (AC6).
  4. resolve model `resolveFeatureModel(ws,'risk_brief')`; ONE
     `llm.completeStructured({ schema: BriefModelOutput, schemaName:'Brief' })` (AC2).
  5. ground `file_refs`/`review_focus.file` against changed files ∪ blast files;
     drop non-resolving refs (AC3).
  6. attach meta (head_sha, degraded, index_status), upsert cache (AC5), return.

### T6 — Route + module registration  → AC1, AC2, AC4, AC5
- `server/src/modules/brief/routes.ts`: `POST /pulls/:id/brief` with
  `{ params: IdParams, querystring: { force?: boolean } }`, workspace-scoped PR
  lookup (like blast), rate-limited like other LLM routes.
- Register `brief` in `server/src/modules/index.ts`.

### T7 — Client hook  → AC4, AC5, AC7
- `client/src/lib/hooks/brief.ts`: `useGenerateBrief(prId)` mutation
  (`POST /pulls/:id/brief`, `force` param); re-export from hooks barrel.

### T8 — `PrBriefCard` + Overview wiring + i18n  → AC7, AC8, AC9
- `client/.../_components/PrBriefCard/`: risk-level color header, what/why,
  risks list (severity chips + file links), review-focus links to `file:line`
  (GitHub blob url helper, as in `BlastTab`), Regenerate button, degraded/empty
  states. Render at top of `OverviewTab`. Add `messages/en/brief.json` keys.

### T9 — Verify  → all AC
- `pnpm typecheck`; cross-model plan review (before coding); plan-verifier pass
  after coding (traceability matrix all-green).

---

## 2. Cross-model review gate

Before T1 code, `plan.md` goes to a model of a **different family** (GPT via a
staff-engineer prompt, no access to this chat). Findings recorded in
`specs/why-risk-brief/cross-model-review.md`.

---

## 3. Traceability matrix (AC → task → test/verify)

| AC | Task(s) | Verify |
|----|---------|--------|
| AC1 assemble from reused sources, no diff hunks | T3,T4,T5 | code review of `service.assembleInput` — no patch fields read |
| AC2 exactly one structured call | T1,T5 | single `completeStructured` call site |
| AC3 refs resolve to real files | T1,T5 | grounding step drops unknown refs |
| AC4 cache hit, no new call | T2,T5,T6 | 2nd open → `cached:true`, no LLM |
| AC5 force regenerate | T2,T5,T6,T7 | `force=true` bypasses cache |
| AC6 input ≤ ~8K tokens | T3,T5 | char-budget guard on sections |
| AC7 card: risk color + focus links | T7,T8 | UI renders links to file:line |
| AC8 degraded index honest | T5,T8 | degraded flag surfaced, still returns |
| AC9 empty state | T5,T8 | no changed files → empty |

---

## 4. Risks / mitigations
- **Model invents file paths** → grounding gate (T5, AC3).
- **Input bloat / cost** → summaries only + char budget (T3,T5, AC6); Sonnet-class model.
- **Degraded index** → deterministic fallback from PR body + diff groups (T5, AC8).
