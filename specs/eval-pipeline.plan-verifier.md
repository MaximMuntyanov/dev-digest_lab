# Plan-Verifier — Eval Pipeline (L06)

Verifies every acceptance criterion in `specs/eval-pipeline.md` is satisfied by
the committed code. Run after implementation, before merge.

| AC | Status | Evidence |
|----|--------|----------|
| AC1 one-click case from finding, kind from accept/dismiss | ✅ | `eval/service.ts#createCaseFromFinding` + `POST /findings/:id/eval-case`; test `eval.it.test.ts` "creates a case from an accepted finding … and a dismissed one" |
| AC2 default `must_find` when neither | ✅ | `createCaseFromFinding` ternary defaults `must_find` |
| AC3 `GET /agents/:id/eval-cases` with latest result | ✅ | `eval/routes.ts` + `repository.listAgentCases`/`latestResultByCase`; test asserts `last_result !== null` |
| AC4 `POST /agents/:id/eval-runs` over all cases, persisted | ✅ | `eval/routes.ts` + `service.runAgentBatch` + `repository.insertBatch`; test "runs a batch and scores deterministically" |
| AC5 recall/precision/citation computed in code, no LLM | ✅ | `eval/scorer.ts` (no provider import) + `eval-scorer.test.ts`; batch test asserts recall 0.5 / precision 0.5 / citation 0.667 |
| AC6 match = same file + overlapping range | ✅ | `scorer.matchesExpected` (`rangesOverlap`); unit test covers file+range cases |
| AC7 batch snapshots version/model/prompt | ✅ | `eval_batches` columns + `insertBatch`; test asserts `agent_version` + `system_prompt` on the batch |
| AC8 history + compare + Evals tab | ✅ | `GET /agents/:id/eval-runs`, `GET /eval/compare`; client `EvalsTab` (metrics, cases, history, CompareModal) |
| AC9 `GET /eval/dashboard` + sidebar page | ✅ | `service.dashboard` + `GET /eval/dashboard`; client `/eval-dashboard` page + nav item (`activeKeyFor` → `eval`) |
| AC10 empty / bad diff degrade, no 500 | ✅ | `runner.runEvalBatch` skips empty/unparseable diffs with a note; empty set returns empty batch |
| AC11 ≥8 seeded cases; prompt change moves metrics | ✅ | `seed-evals.ts` 10 cases; test "seed ships >=8 …"; test "changing the system prompt moves precision between two runs" |
| AC12 `pnpm verify:l06` green | ✅ | `scripts/verify-l06.sh` + root `package.json`: server typecheck + 9 eval tests + client typecheck all pass |

## Minor notes / follow-ups
- Manual Case Editor, trend graphs, skill evals in `evals/`, PreToolUse hook and
  mutation testing are **Stretch** (spec §7) and intentionally not built here.
- Precision is scoped to the case set (TP = matched must_find, FP = flagged
  must_not_flag), per the cross-model resolution P1.

**Verdict: all AC1–AC12 SATISFIED.**
