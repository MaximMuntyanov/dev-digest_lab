# Implementation Plan — Eval Pipeline (L06)

> Produced by implementation-planner from `specs/eval-pipeline.md`.
> Every task cites the AC-IDs it satisfies. Committed before feature code.

## Reuse map (build on, don't rebuild)
- **Engine**: `reviewer-core` `reviewPullRequest` → `outcome.review.findings`
  (kept) + `outcome.dropped` (grounding drops) + `tokensIn/Out`, `costUsd`.
  `groundFindings/groundingSummary` already give the citation gate.
- **Diff**: `server/src/adapters/git/diff-parser.ts` `parseUnifiedDiff(raw)`.
- **Findings + accept/dismiss**: `reviews` module — `findingContext(findingId)`
  resolves `{finding, review, pull}`; `acceptedAt/dismissedAt` on `findings`.
- **Contracts**: `EvalCase*`, `EvalRun*`, `EvalDashboard` in `contracts/{knowledge,eval-ci}.ts`
  (extend, mirror in server+client trees).
- **Module shape**: mirror `blast/` + `brief/` (routes+service+repository, `getContext`).
- **Client**: hooks pattern `lib/hooks/reviews.ts`; page pattern
  `app/project-context/page.tsx`; AgentEditor tabs; FindingCard/FindingsPanel;
  nav.ts (`activeKeyFor` already routes `/eval*` → `"eval"`).

## Ordered tasks

- **T1 — Schema + migration** (AC1, AC6, AC7): add `expectation_kind`,
  `source_finding_id`, `created_at` to `eval_cases`; add `batch_id` to `eval_runs`;
  new `eval_batches` table. Drizzle `db:generate`.
- **T2 — Contracts** (AC1, AC3, AC5, AC8, AC9): add `EvalExpectationKind`,
  `EvalCaseRecord` (+ expectation_kind/source/created_at/last_result),
  `EvalCasePerResult`, `EvalBatchRecord`, `EvalCompare`, `EvalDashboardV2`.
  Mirror in server + client vendored trees + barrels.
- **T3 — Scorer** (AC5, AC6): pure module `eval/scorer.ts` — file+range overlap,
  recall/precision/citation from kept+dropped vs expected. Unit-tested, no LLM.
- **T4 — Eval runner** (AC4, AC5, AC7, AC10): `eval/runner.ts` — for each case
  parse diff, call `reviewPullRequest` with the agent's prompt/model, ground,
  score; aggregate into a batch; skip unparutable cases.
- **T5 — Repository** (AC3, AC4, AC7, AC8, AC9): `eval/repository.ts` CRUD for
  cases, insert batch + per-case rows, list runs, dashboard aggregates.
- **T6 — Routes** (AC1, AC3, AC4, AC8, AC9): `eval/routes.ts` —
  `POST /findings/:id/eval-case`, `GET/POST/DELETE /agents/:id/eval-cases`,
  `POST /agents/:id/eval-runs`, `GET /agents/:id/eval-runs`,
  `GET /agents/:id/eval-runs/compare?a=&b=`, `GET /eval/dashboard`. Register module.
- **T7 — Client hooks** (AC1, AC3, AC4, AC8, AC9): `lib/hooks/eval.ts`.
- **T8 — FindingCard button** (AC1, AC2): "Turn into eval case" button +
  `useCreateEvalCaseFromFinding`, wired through FindingsPanel.
- **T9 — Evals tab** (AC8): `AgentEditor/_components/EvalsTab` — metrics, cases
  list (per-case status), Run all evals, run history + compare modal. Add tab.
- **T10 — Eval Dashboard page** (AC9): `app/eval-dashboard/page.tsx` + nav item.
- **T11 — Seed ≥8 cases** (AC11): seed eval cases for the Security agent from
  demo findings (mix of must_find/must_not_flag).
- **T12 — verify:l06** (AC12): `scripts/verify-l06.sh` + root `package.json`
  wrapper (`pnpm verify:l06`), running server typecheck + eval tests.
- **T13 — Experiment** (AC11): two runs old vs new prompt; break prompt → precision drops.

## Traceability
AC1→T1,T6,T8 · AC2→T8 · AC3→T5,T6,T7 · AC4→T4,T5,T6 · AC5→T3,T4 · AC6→T3 ·
AC7→T1,T4,T5 · AC8→T6,T9 · AC9→T6,T10 · AC10→T4 · AC11→T11,T13 · AC12→T12.

## Risks / mitigations
- **R1** Given per-case `eval_runs` can't compare runs → **mitigate** with
  `eval_batches` (T1).
- **R2** Real LLM in eval runner makes tests flaky → **mitigate**: tests inject a
  `MockLLMProvider` with fixed structured output; scoring asserted deterministically.
- **R3** Precision definition with `must_not_flag` — **decision**: an emitted
  finding matching a `must_not_flag` case is a false positive; emitted findings
  matching a `must_find` case are true positives; precision = TP/(TP+FP).
