# reviewer-core gotchas

Non-obvious behaviors discovered the hard way. Read this first when something in
`reviewer-core/` behaves unexpectedly, before digging through source.

## Grounding silently drops findings

If a review returns fewer findings than the model produced, the **citation-grounding gate**
(`grounding.ts`) dropped the extras: a diff-finding is kept only if its line range intersects
a real hunk. Check the `grounding dropped "…"` events in the run trace — a "hallucinated"
line reference is the usual cause, not a bug.

## Full-file finding kinds bypass line intersection

Findings whose `kind` is in `{secret_leak, lethal_trifecta, phantom, hook}` are treated as
full-file: they ground against the file merely being present in the diff, not against a hunk.
A secret-scanner finding on an unchanged line is therefore expected, not a grounding leak.

## map-reduce only triggers on large AND multi-file diffs

`selectMode('auto', …)` uses map-reduce only when total changed lines exceed the threshold
(default 400) **and** the diff touches more than one file. A single huge file stays
single-pass — if you expected per-file chunking and didn't get it, that's why.

## Score never matches the model's self-report

The final score is derived from findings that survived grounding
(`scoreFromFindings(ground.kept)`), so it can differ from any number the model emitted. This
is intentional: score, findings list, and the deterministic event always agree.
