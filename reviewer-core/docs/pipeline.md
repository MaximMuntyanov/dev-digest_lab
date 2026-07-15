# reviewer-core pipeline contracts

`reviewer-core/` is the **pure** review engine: `given (diff + resolved inputs + injected
LLM) → grounded Review`. It is lifted out of the server so the same code runs in the studio
(server persists + streams SSE) and in CI (runner posts + writes an artifact).

Entry point: `reviewer-core/src/review/run.ts` → `reviewPullRequest(input)`.

## Rules

### `reviewer-core-zero-io`

The engine performs **no I/O except the injected `LLMProvider`** — no filesystem, no DB, no
GitHub, no `process.env`, no network. Everything the engine needs is passed in `ReviewInput`
as already-resolved values (skill bodies, memory, specs are resolved **strings**, not slugs;
the diff is already parsed). The caller owns all I/O.

> Violation example: `import { readFileSync } from "node:fs"` (or any DB/GitHub/env access)
> added inside `reviewer-core/src/**`. Fix: resolve the value in the caller and pass it in.

### `reviewer-core-ground-findings-gate`

The **citation-grounding gate is mandatory** and is the only post-step: after reducing the
model's partials, every diff-finding must pass `groundFindings(findings, diff)` before it is
emitted. A finding is kept only if its `[start_line, end_line]` intersects a real diff hunk
for the same file; hallucinated locations are dropped. `runPipeline` / `reviewPullRequest`
must **not** return the raw/deduped findings directly, bypassing the gate.

> Violation example: `return deduped;` instead of returning the grounded set. Fix: keep
> `const ground = groundFindings(merged.findings, input.diff); return ground.kept;`.

The score is derived from the findings that **survived** grounding — never the model's
self-reported number.

## Read When

- Changing the **review pipeline** (`reviewer-core/src/**`) → read this file first and keep
  both rules above intact.
