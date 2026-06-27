# CLAUDE.md — DevDigest Project Context

## Project Overview

DevDigest is a local-first AI pull-request review tool. Four independent packages
(no monorepo workspace), cross-package code shared via tsconfig path aliases.

| Package | Path | Stack |
|---------|------|-------|
| API | `server/` | Fastify 5 + Drizzle ORM + Postgres (pgvector) |
| Web | `client/` | Next.js 15 + Tailwind CSS 4 + TanStack Query |
| Engine | `reviewer-core/` | Pure TS — diff → prompt → LLM → findings |
| E2E | `e2e/` | agent-browser (deterministic, no LLM) |
| Shared | `*/src/vendor/shared/` | Zod contracts vendored into client + server |

## Architecture

```
Browser :3000 → Next.js (client/) → REST → Fastify :3001 (server/) → Postgres :5432
                                                ↓
                                        reviewer-core/ → LLM (OpenRouter)
```

Review flow: add repo → clone + repo-intel indexes → import PRs from GitHub →
run review → reviewer-core builds prompt (diff + repo map) → LLM → grounding
gate (drops hallucinated line references) → structured findings (severity + score).

## Key Commands

```bash
./scripts/dev.sh              # full stack: Docker → migrate → seed → API + web
./scripts/dev.sh --db-only    # just Postgres

cd server && pnpm dev         # API on :3001
cd client && pnpm dev         # web on :3000

cd server && pnpm test        # all server tests
cd server && pnpm exec vitest run --exclude '**/*.it.test.ts'  # unit only
cd server && pnpm exec vitest run .it.test                     # integration only
cd client && pnpm test        # client component tests
cd reviewer-core && npm test  # engine tests
```

## Conventions

- **Styling**: co-located `styles.ts` per component, exports `s` object with
  `CSSProperties` (inline styles). Design tokens via CSS variables.
- **Components**: co-located folders with `Component.tsx`, `constants.ts`,
  `helpers.ts`, `styles.ts`, `index.ts` barrel.
- **Tests**: `*.test.tsx` for unit/component, `*.it.test.ts` for DB-backed
  integration (testcontainers Postgres). Hermetic by default — use
  `server/src/adapters/mocks.ts` for stubs.
- **Shared types**: Zod schemas in `vendor/shared/contracts/`. Single source of
  truth for API + UI + engine.
- **i18n**: `next-intl`, messages in `client/messages/en/*.json`.
- **Severity levels**: `CRITICAL | WARNING | SUGGESTION` (contract);
  UI primitives also know `INFO` defensively.

## Session Protocol

- Before starting work, read `INSIGHTS.md` and treat entries as high-confidence
  guidance unless told otherwise.
- At end of session, update `INSIGHTS.md` with non-obvious patterns, mistakes,
  or decisions discovered during the session. Do not skip this step.
