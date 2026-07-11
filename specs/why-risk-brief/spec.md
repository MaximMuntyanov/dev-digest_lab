# Feature Spec — PR Why + Risk Brief

- **Status:** approved
- **Owner:** DevDigest
- **Produced by:** spec-creator (SDD), manual run in Cursor
- **Scope size:** small feature (single route + one structured LLM call + one card)

> Grounding note: this spec was written first (SDD), before any implementation
> code. Inputs and downstream impact were grounded against the repo via the
> `devdigest-mcp` tools (L04) and the repo-intel index — not guessed. Anything we
> could not ground is marked `[NEEDS CLARIFICATION]` and resolved below.

---

## 1. Problem & why

A reviewer opening a PR asks three questions before reading a single line of the
diff: **what does this change do, why, and what can it break?** Today DevDigest
already computes the raw ingredients for that answer — PR intent (L03), the blast
radius map (L04), diff group statistics (L03), the linked issue, and attached
project-context specs (L05) — but they live in separate places and none of them
answers the reviewer's question in one glance.

The **Why + Risk Brief** composes those existing ingredients into a single card
at the top of the PR: *what · why · risk level · concrete risks (with links to
real files) · review-focus (read these first)*. The key property is that the
feature is **almost free**: it reuses everything built on L03–L05 and adds
exactly **one** structured LLM call. No new indexing, no diff re-parsing, no
per-file model calls.

---

## 2. Goals / Non-goals

### Goals
- One route `POST /pulls/:id/brief` that assembles input from already-built
  sources and returns a `Brief`.
- Exactly **one** structured LLM call per generation.
- Risks point at **real** files/endpoints taken from the blast map / changed
  files — never invented paths.
- Per-PR cache; a "Regenerate" button forces a fresh call.
- `PrBriefCard` on the PR Overview: risk level by color, review-focus items link
  to `file:line` in code.

### Non-goals
- No auto-selection of which specs to attach (manual Context Folder attach only;
  flash-selector is future work).
- No new LLM call for intent/blast/diff-groups — those are reused/deterministic.
- No putting **raw change bodies (diff hunks)** into the LLM input — only
  summaries/statistics. (Keeps the input small and the feature cheap.)
- WhyTimeline (history of briefs across commits) is **stretch**, not core.

---

## 3. User stories

- **US1** — As a reviewer, I open a PR and immediately see a card telling me what
  the PR does, why, and its risk level, so I can orient before reading the diff.
- **US2** — As a reviewer, I see concrete risks each linking to a real file so I
  can jump straight to the dangerous spot.
- **US3** — As a reviewer, I see a "review-focus / read these first" list linking
  to `file:line`, so I know where to start.
- **US4** — As a reviewer, re-opening the same PR shows the brief instantly from
  cache (no new cost), and I can press "Regenerate" when the PR changed.

---

## 4. Acceptance criteria (EARS)

Each AC has an ID used by the plan's traceability matrix.

- **AC1** — WHEN a client sends `POST /pulls/:id/brief`, the system SHALL assemble
  the model input from: PR intent (title/body/linked issue), blast summary
  (counts + endpoints + top changed symbols), diff group statistics
  (core/wiring/boilerplate + additions/deletions), and attached project-context
  specs; and SHALL NOT include raw diff hunks.
- **AC2** — WHEN the input is assembled, the system SHALL make **exactly one**
  structured LLM call returning `Brief { what, why, risk_level, risks[],
  review_focus[] }`.
- **AC3** — The system SHALL ensure every `risks[].file_refs` and every
  `review_focus[].file` refers to a file that is present in the PR's changed
  files or blast map; references that do not resolve SHALL be dropped.
- **AC4** — WHEN a cached brief exists for the PR's current head SHA, the system
  SHALL return it WITHOUT making a new LLM call.
- **AC5** — WHEN the request carries `force=true` (Regenerate), the system SHALL
  bypass the cache and produce a fresh brief, then overwrite the cache.
- **AC6** — The assembled model input SHALL stay within a bounded budget
  (≤ ~8K tokens, enforced via a character budget on the summary sections).
- **AC7** — The `PrBriefCard` SHALL render `risk_level` with color coding
  (high/medium/low) and render `review_focus[]` items as links that open the
  referenced `file:line` on GitHub.
- **AC8** — WHERE the repo-intel index is degraded/failed, the system SHALL still
  return a brief (blast counts may be zero) and surface an honest degraded note,
  rather than erroring or showing an empty screen.
- **AC9** — WHEN there is no data to build a brief (no changed files), the system
  SHALL return an empty-state response the UI renders as an empty state.

---

## 5. Inputs & provenance

Provenance tags: `[reused]` already computed elsewhere, `[deterministic]`
computed here with no model, `[new call]` the single LLM call.

| Input | Provenance | Source |
|---|---|---|
| PR title / body / author | `[reused]` | `pull_requests` row |
| Linked issue (title/body) | `[reused]` | `github().getIssue` / `PrDetail.linked_issue` (L03) |
| Blast summary (counts, endpoints, top symbols) | `[reused]` | `blast/service.ts` `getPrBlast` (L04) |
| Diff group stats (core/wiring/boilerplate, +/-) | `[deterministic]` | `pr_files` + `repoIntel.getFileRank` (L03) |
| Attached project-context specs (markdown) | `[reused]` | Context Folder / `specs`,`docs`,`insights` (L05) |
| `Brief { what, why, risk_level, risks[], review_focus[] }` | `[new call]` | one `llm.completeStructured` |

**Never** an input: raw diff hunks / file patches (Non-goal).

---

## 6. Contract (Brief)

```
RiskLevel = 'high' | 'medium' | 'low'
BriefRisk = { title, explanation, severity: RiskLevel, file_refs: string[] }
ReviewFocusItem = { file: string, line?: int, reason: string }
Brief = {
  what: string,
  why: string,
  risk_level: RiskLevel,
  risks: BriefRisk[],
  review_focus: ReviewFocusItem[],
  // meta (deterministic, not from the model)
  head_sha: string,
  generated_at: string,   // ISO
  cached: boolean,
  degraded: boolean,
  index_status: 'full'|'partial'|'degraded'|'failed',
  empty: boolean,
}
```
Reuses `RiskSeverity` semantics from the existing `brief.ts` contract.

---

## 7. Edge cases

- **Degraded index** → blast counts zero; still produce what/why/risks from
  PR body + diff groups; set `degraded=true`, `index_status` surfaced (AC8).
- **No changed files** → `empty=true`, no LLM call (AC9).
- **Model returns a file_ref not in the change set** → drop it (AC3), never show
  a dead link.
- **Head SHA moved since cache** → treat as cache miss, regenerate (AC4).
- **No linked issue / no specs attached** → sections omitted, brief still works.
- **Input too large** → truncate summary sections to the char budget (AC6).

---

## 8. Out of scope (explicit)

- Auto spec selection (flash-selector).
- Intent as its own LLM producer (we reuse deterministic PR/issue text).
- SmartDiff full pseudocode summaries (we use group stats only).
- WhyTimeline across commits (stretch).

---

## 9. Open questions — resolved

- **[NEEDS CLARIFICATION]** Should intent be a separate LLM call? → **No.** The
  single Brief call derives `what`/`why` from reused PR/issue text + diff groups
  (Non-goal: extra calls).
- **[NEEDS CLARIFICATION]** Where is the brief cached? → Existing `pr_brief`
  table (jsonb keyed by `pr_id`); invalidate by stored `head_sha`.
- **[NEEDS CLARIFICATION]** Which model? → `resolveFeatureModel(ws,'risk_brief')`
  (already configured); use Sonnet-class per lab cost guidance.
