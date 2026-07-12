# SDD Agent Registry

The spec-driven-development (SDD) pipeline. Each agent has one job; together they
take a rough idea to merged, verified code. Feature work is driven by these
agents — spec and plan are written by the pipeline and committed **before** the
code.

## The pipeline (order)

1. **spec-creator** (`opus`, read-only + Write to `specs/`) — runs a 6-category
   clarifying dialog and writes a small feature `spec.md` (Problem & why · User
   stories · AC in EARS · Out of scope · Edge cases · Inputs provenance).
   Answers **what & why**. Unknowns → `[NEEDS CLARIFICATION]`.
2. **implementation-planner** (`opus`, read-only + Write to `specs/`) — consumes
   the approved `spec.md` and writes `plan.md`: ordered tasks, each referencing
   the AC-IDs it satisfies → a **traceability matrix**. Answers **how & in what
   order** only (the spec part lives in spec-creator).
3. **implementer** (`sonnet`) — writes the code for one task at a time.
4. **test-writer** (`sonnet`) — writes tests derived from the spec's AC (not the
   code).
5. **architecture-reviewer** (`sonnet`, read-only) — design/boundary gate.
6. **plan-verifier** (`opus`, read-only) — verifies every AC is really done by
   walking the traceability matrix (AC → task → code → test) before merge.

Nested helper: **researcher** (`sonnet`, read-only) — focused, grounded
investigation, invoked by the others.
Docs: **doc-writer** (`sonnet`) — concise, grounded docs / PR descriptions.

## Clean separation
- `spec-creator` → **what & why**
- `implementation-planner` → **how & in what order**
- `plan-verifier` → **is it actually done?**

## Cost guidance (first runs)
- Move Opus pipeline/reviewer agents to **Sonnet** for the first runs — Opus is
  expensive on every pass.
- Disable or limit test writing (especially e2e / n-tests) on the first runs; a
  few sub-optimal SDD runs can eat the whole 5-hour limit.

## Retrospective
After a run, invoke the **workflow-retro** skill (`.claude/skills/workflow-retro`)
to see tokens / cache-hit / tool-calls / durations / parallelism (incl. nested
sub-agents) and get concrete recommendations; it appends a row to
`docs/retros/ledger.md` so runs can be compared.

## Grounding
All agents ground their work in the real repo via `devdigest-mcp` (L04:
`list_agents`, `get_findings`, `get_blast_radius`, `get_conventions`) plus
Read/Grep/Glob.
