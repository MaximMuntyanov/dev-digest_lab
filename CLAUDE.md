# CLAUDE.md — DevDigest Project Context

## Project Overview

DevDigest is a local-first AI pull-request review tool. Independent packages
(no monorepo workspace), cross-package code shared via tsconfig path aliases.

| Package | Path | Stack |
|---------|------|-------|
| API | `server/` | Fastify 5 + Drizzle ORM + Postgres (pgvector) |
| Web | `client/` | Next.js 15 + Tailwind CSS 4 + TanStack Query |
| Engine | `reviewer-core/` | Pure TS — diff → prompt → LLM → grounded findings |
| E2E | `e2e/` | agent-browser (deterministic, no LLM) |
| MCP | `mcp/` | Standalone MCP server exposing DevDigest tools |
| Evals | `evals/` | Harness evals for `.claude/*` (vitest + Claude Agent SDK) |
| Shared | `*/src/vendor/shared/` | Zod contracts vendored into client + server |

## Architecture

```
Browser → Next.js (client/) → REST → Fastify (server/) → Postgres
                                          ↓
                                  reviewer-core/ → LLM (OpenRouter)
```

Review flow: add repo → clone + repo-intel indexes → import PRs from GitHub →
run review → reviewer-core assembles prompt (diff + repo map) → LLM → citation
grounding gate (drops hallucinated line refs) → structured findings.

## Key Commands

```bash
./scripts/dev.sh              # full stack: Docker → migrate → seed → API + web
cd server && pnpm dev         # API
cd client && pnpm dev         # web
cd server && pnpm test        # server tests (unit + integration)
cd reviewer-core && npm test  # engine tests
pnpm verify:l06               # L06 product eval-pipeline gate

# Harness evals (evals/) — run on the Claude Code subscription, no API token
cd evals && pnpm install
pnpm eval:quality             # tier 0: static SKILL.md checks, no model, no cost
pnpm eval:skills              # tier 1: LLM-judged skill content
pnpm eval:agents              # tier 1: LLM-judged subagent content
pnpm eval:workflow            # tier 2: real harness, trace-asserted behavior
pnpm eval                     # all tiers
pnpm eval:repeat / eval:delta / eval:benchmark   # stability / version-vs-version / with-vs-without
```

## Read When

Consult the mapped doc **before** touching the area — do not reverse-engineer from source.

| When you… | Read first |
|-----------|------------|
| add or change an HTTP endpoint / route, or review its design | `server/docs/api-contracts.md` |
| change the review pipeline (`reviewer-core/src/**`) | `reviewer-core/docs/pipeline.md` |
| hit unexpected behavior in `reviewer-core/` | `reviewer-core/insights/gotchas.md` |
| attach project context to an agent | `docs/agent-prompts/` and `specs/` |

## Subagents

Dispatch a subagent instead of doing the work inline when the task matches:

- **architecture-reviewer** — read-only architecture/layering/DI gate. When asked to review
  a change or a *plan* for boundary/contract violations, dispatch it; do **not** review inline.
  It cites the documented rule id (`inward-only-dependencies`, `di-discipline`,
  `reviewer-core-zero-io`, `reviewer-core-ground-findings-gate`) for every finding.
- **spec-creator → implementation-planner → plan-verifier** — the SDD chain for a new feature.

## Evals — self-check loop

The harness tests itself. **When you change an artifact under `.claude/`, run the matching
eval before committing** — the artifact and its eval are versioned in the same commit, the way
a function and its unit test are.

| Change | Run before commit |
|--------|-------------------|
| `.claude/skills/<skill>/**` | `pnpm eval:quality <skill>` then `pnpm vitest run skills/<skill>` |
| `.claude/agents/<agent>.md` | `pnpm vitest run agents/<agent>` |
| `CLAUDE.md` (routing / dispatch) | `pnpm eval:workflow` |
| any `.claude/*` before a PR | `pnpm eval:quality` (blocking) + the tier above |

A new skill or agent ships **with its cases** in the same commit. `pnpm eval:quality` warns
about artifacts that still lack an eval file — that warning is the coverage map to close.

## Conventions

- **Styling**: co-located `styles.ts` per component exporting an `s` object of `CSSProperties`.
- **Components**: co-located folders — `Component.tsx`, `constants.ts`, `helpers.ts`,
  `styles.ts`, `index.ts` barrel.
- **Tests**: `*.test.ts(x)` unit/component, `*.it.test.ts` DB-backed integration.
- **Shared types**: Zod schemas in `vendor/shared/contracts/` — single source of truth.
- **i18n**: `next-intl`, messages in `client/messages/en/*.json`.

## Session Protocol

- Before starting, read `INSIGHTS.md` and treat entries as high-confidence guidance.
- When you discover a non-obvious cause or gotcha during a session, record it (the
  `engineering-insights` skill appends it to `INSIGHTS.md`). Do not skip this.
