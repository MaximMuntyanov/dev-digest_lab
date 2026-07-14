# Cross-model plan review — Eval Pipeline (L06)

Plan authored on the Claude/Opus family; reviewed with a different model family
(GPT) per the L05 SDD gate. Findings and author resolutions below.

## P1 — Precision must be well-defined for `must_not_flag` (blocking)
**Finding.** "precision = matched findings / all emitted" is ambiguous when a run
emits findings on files not covered by any case. Without pinning it, dismissed
cases won't move precision and AC5/AC11 can't be demonstrated.
**Resolution.** Precision is computed **against the case set only**: an emitted
finding is a *true positive* if it matches a `must_find` case's file+range, a
*false positive* if it matches a `must_not_flag` case's file+range; emitted
findings outside every case's file are ignored (out-of-scope for this set).
`precision = TP / (TP + FP)`. Breaking the prompt so it flags the
`must_not_flag` fixtures raises FP → precision drops. (Encoded in T3, R3.)

## P2 — Runs must stay comparable after the agent is edited (blocking)
**Finding.** If a run only references `agent_id`, editing the prompt makes old
runs incomparable / mislabelled.
**Resolution.** Snapshot `agent_version`, `model`, and `system_prompt` onto each
`eval_batches` row at run time (AC7, T1/T4/T5). Compare reads the two snapshots
and diffs the prompts.

## P3 — "Zero LLM in scoring" must be provable (should-fix)
**Finding.** The agent review is an LLM call; a reader may think scoring calls a
judge.
**Resolution.** Scoring lives in a pure `eval/scorer.ts` with no provider import;
the runner does the (already-existing) review call, scorer only consumes its
output. Tests run the scorer directly with fixture findings (no provider) to
prove determinism (T3, AC5, AC12).

## P4 — Empty / broken cases must not 500 (should-fix)
**Finding.** Unparutable diff or zero cases could throw.
**Resolution.** Runner skips unparutable cases with a note and returns an empty
batch for zero cases; recall defined 1.0 when no `must_find` cases (AC10, edge
cases in spec).

All P1–P4 resolved in `eval-pipeline.plan.md`. No open blockers.
