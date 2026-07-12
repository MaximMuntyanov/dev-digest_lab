---
name: workflow-retro
description: "Run a retrospective on a multi-agent SDD workflow run (spec-creator → implementation-planner → implementer → test-writer → architecture-reviewer → plan-verifier, plus nested researchers). Use manually AFTER a run to see tokens (in/out/cache-read), cache-hit, tool-calls, durations and parallelism — including nested sub-agents — then produce concrete recommendations and append a trend row to docs/retros/ledger.md. Manual only, no hook."
---

# Workflow Retro

Our 5-step SDD pipeline is already a **multi-agent run**. This skill inspects how a
run actually went and turns it into concrete improvements. Run it **manually**,
only when a run is worth dissecting — there is deliberately no hook.

It is the first touch of observability (L07) and cost-engineering (L08), and it
feeds the cost-report in the homework.

---

## What to measure

Collect these metrics for the run, per agent **and** for nested sub-agents:

| Metric | Notes |
|--------|-------|
| Tokens in / out / cache-read | The parent `<usage>` does **not** count nested sub-agents, so in-context numbers **under-count**. Use deep mode (below) for the real total. |
| Cache-hit ratio | cache-read ÷ input. Low ratio → context is being rebuilt each call. |
| Tool-calls | count per agent; spot redundant re-reads of the same file. |
| Durations | wall-clock per agent + total. |
| Parallelism | how many agents/sub-agents ran concurrently. |

### in-context vs deep mode
- **in-context** — read the current session's `<usage>` blocks. Fast, but blind to
  nested sub-agents (under-counts tokens).
- **deep** — read the run journals from disk (the run logs / traces) so nested
  researcher/implementer sub-agent usage is included. Prefer deep for real totals.

---

## Procedure

1. Identify the run (feature + timestamp). Locate its journals on disk for deep mode.
2. Aggregate the metrics above, parent + nested. Note where in-context and deep
   disagree (that gap *is* an insight).
3. **Insights** — what was hard, what was duplicated in context, what was missed.
4. **Recommendations** — turn each insight into a concrete action, e.g.:
   - tighten an agent's brief,
   - pre-fetch a shared file once instead of re-reading it in N agents,
   - merge or split agents,
   - change concurrency.
5. **Trend** — append one row to `docs/retros/ledger.md` (create it if missing) so
   runs can be compared over time.

## Ledger format (`docs/retros/ledger.md`)

```
| date | feature | tokens_in | tokens_out | cache_read | cache_hit | tool_calls | duration | agents | top_recommendation |
|------|---------|-----------|------------|------------|-----------|------------|----------|--------|--------------------|
```

## Output

A short retro report: **Metrics table** (parent vs deep) → **Insights** →
**Recommendations (actionable)** → the **ledger row** you appended. Keep it tight
and grounded in the run's real numbers — no guessing.
