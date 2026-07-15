# Feature Spec — Eval Pipeline for DevDigest agents (L06)

> Produced by the SDD pipeline (spec-creator). Answers **what & why**, not how.
> Committed **before** any feature code.

## 1. Problem & why

Today the only way to tell whether an edit to a review agent (system prompt,
model, linked skill) made it **better or worse** is to eyeball one review and
guess. There is no regression net for the probabilistic core of the product.

We already own the perfect dataset: every `accept` / `dismiss` decision from
L01–L05 is a labelled example. An **accepted** finding is something the agent
*should* find; a **dismissed** finding is noise it *should not* flag. We turn
those decisions into eval cases, run an agent over the whole set, and score it
deterministically — so a prompt change shows up as a **number moving**, not a
vibe.

This is Experiment 3 from the lab (compare two versions of an agent by metrics),
moved from the harness plane into the product plane and built by hand.

## 2. Goals / Non-goals

### Goals
- Turn a real finding into an eval case in **one click** (accepted → `must_find`,
  dismissed → `must_not_flag`).
- Run an agent over **all** its cases with fixed inputs, so runs of different
  agent versions are comparable.
- Score entirely **in code** (recall / precision / citation_accuracy) — **zero
  LLM calls in scoring**.
- Show metrics per run, run history, and compare two runs side by side
  (old prompt vs new).
- Surface it in the UI: an **Evals** tab in the Agent editor and a global
  **Eval Dashboard** page.

### Non-goals
- No LLM judge (the lab needed one because "explained the reason" isn't a
  substring; here the expectation is `file:line`, matched by code).
- No auto-thresholds / merge-blocking gate (that is L06 CI, out of scope here).
- No skill-level evals in the product (the harness `evals/` package covers skills
  — that is a Stretch task, not Core).
- No manual case editor, trend graphs beyond the basic dashboard, hooks, or
  mutation testing (all listed as Stretch).

## 3. User stories
- **US1** As a reviewer, I can create an eval case from a finding with one click,
  so building the dataset costs nothing.
- **US2** As a reviewer, I can see all eval cases of an agent and each case's last
  result (pass / fail / never run).
- **US3** As a reviewer, I can run an agent over all its cases and get
  recall / precision / citation_accuracy for that run.
- **US4** As a reviewer, I can open the run history and compare two runs side by
  side, seeing the metric deltas and the system-prompt diff.
- **US5** As a reviewer, I can open an Eval Dashboard that lists agents with their
  latest metrics and the most recent eval runs across the workspace.

## 4. Acceptance criteria (EARS)

- **AC1** WHEN the user clicks "Turn into eval case" on a finding, the system
  SHALL create an eval case owned by the finding's agent, storing the finding's
  `file` + `start_line`–`end_line` + the containing diff fragment, with
  `expectation_kind = must_find` if the finding is accepted and
  `must_not_flag` if it is dismissed.
- **AC2** WHERE a finding is neither accepted nor dismissed, the system SHALL
  default the new case to `must_find` (treat as "should find").
- **AC3** The system SHALL expose `GET /agents/:id/eval-cases` returning all
  eval cases for that agent with each case's latest per-case result.
- **AC4** WHEN the user triggers `POST /agents/:id/eval-runs`, the system SHALL
  run the agent over every case with fixed inputs and persist one **batch run**
  plus one **per-case result** per case.
- **AC5** The system SHALL compute, per batch run, `recall` = matched expected /
  total `must_find` cases, `precision` = matched findings / all emitted findings
  counted against the set (dismissed `must_not_flag` cases lower precision when
  flagged), and `citation_accuracy` = findings surviving the grounding gate / all
  emitted findings — **using code only, with no LLM call**.
- **AC6** A `must_find` case SHALL count as matched WHEN an emitted finding has
  the **same file** and its `[start_line,end_line]` **overlaps** the expected
  range; a `must_not_flag` case SHALL pass WHEN no emitted finding matches its
  file+range.
- **AC7** The system SHALL persist on each batch run the agent `version`, `model`,
  and `system_prompt` snapshot, so two runs remain comparable after the agent is
  edited.
- **AC8** The system SHALL expose run history (`GET /agents/:id/eval-runs`) and a
  compare of two runs (metric deltas + system-prompt diff), and an
  `Evals` tab in the Agent editor rendering cases + history + latest metrics.
- **AC9** The system SHALL expose `GET /eval/dashboard` and a left-sidebar
  **Eval Dashboard** page listing agents with latest metrics and recent runs.
- **AC10** IF an agent has no cases OR a case diff cannot be parsed, THEN the
  system SHALL degrade honestly (empty state / skip the case with a note), never
  a blank screen or a 500.
- **AC11** The agent's eval set SHALL contain **≥8 cases** in the seeded demo
  workspace, and changing the agent's system prompt SHALL visibly move
  recall/precision between two consecutive runs.
- **AC12** `pnpm verify:l06` SHALL run green (typecheck + the eval scorer/route
  tests).

## 5. Inputs & provenance

| Input | Provenance | Source |
|-------|-----------|--------|
| Eval case (diff + expected file:line + kind) | `[reused]` | derived from a persisted `finding` (accept/dismiss) |
| Agent run over a case | `[reused]` | `reviewPullRequest` engine (reviewer-core), same as normal reviews |
| Grounding pass/drop (for citation_accuracy) | `[reused]` | `outcome.review.findings` + `outcome.dropped` from the engine |
| Score (recall/precision/citation) | `[deterministic]` | pure code, file+line overlap; **no model** |
| Agent version/model/prompt snapshot | `[reused]` | `agents` row at run time |

**No new LLM call is introduced by scoring.** The agent review itself uses the
model (as any review does); scoring is deterministic.

## 6. Data model (extends the given starter schema)

Given (starter): `eval_cases`, `eval_runs`. We add a batch layer so runs are
comparable version-to-version (the given `eval_runs` is per-case).

- `eval_cases` (given) **+** `expectation_kind` (`must_find`|`must_not_flag`),
  `source_finding_id` (nullable), `created_at`. `expected_output` jsonb keeps the
  expected finding `{file,start_line,end_line,severity,category,title}`.
- `eval_runs` (given, per-case) **+** `batch_id` FK. One row per case per batch.
- **NEW** `eval_batches` — the "run" shown in history/compare/dashboard:
  `id, workspace_id, agent_id, agent_version, model, system_prompt, ran_at,
  cases_total, passed, recall, precision, citation_accuracy, cost_usd,
  duration_ms`.

## 7. Out of scope
Skill evals in `evals/`, manual case editor, trend graphs, PreToolUse hook,
mutation testing (all Stretch); CI merge-gate and thresholds (L06 CI).

## 8. Edge cases
- Agent with 0 cases → empty state; run returns an empty batch (no 500).
- Case diff unparutable → skip with a note in the batch result; other cases run.
- `must_not_flag` with 0 emitted findings → passes (precision unaffected).
- No `must_find` cases in the set → recall defined as 1.0 (nothing to miss) and
  documented.
- Agent deleted after a run → batch keeps its snapshot (agent_id set null).

## 9. Open questions
_None blocking._ `[RESOLVED]` batch layer added because the given per-case
`eval_runs` alone can't support "compare two runs / trend" required by US4/US5.
