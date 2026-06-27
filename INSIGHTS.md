# INSIGHTS.md — Engineering Insights

Accumulated learnings from working on DevDigest. Each entry is actionable and
non-obvious. Treat as high-confidence guidance.

---

## What Works (Patterns)

### 2026-06-27 — Severity counters feature

- **Reuse `SeverityBadge` with `count` prop** for any per-severity counter UI.
  The component in `vendor/ui/primitives/Badge.tsx` already handles icon + label
  + number rendering — wrap it in a clickable div rather than rebuilding.

- **Extend `visibleFindings()` with new filter params** (default `null`) to keep
  backward compatibility. Existing callers don't break because the new parameter
  is optional with a default value.

- **`s.divider` style in FindingsPanel was pre-built** but unused — it was
  clearly intended for separating toolbar sections. Check for pre-existing unused
  styles before creating new ones.

- **`SEVERITY_KEYS` constant for iteration order** avoids relying on
  `Object.keys()` ordering from `SEVERITY_ORDER` record. Always use an explicit
  array when display order matters.

## What Doesn't Work (Mistakes / Antipatterns)

### 2026-06-27

- **Node 18 is incompatible with this project.** pnpm 11 requires Node >= 22.13,
  and `@vitejs/plugin-react` ESM imports fail under Node 18 CJS require. Always
  use Node 22+ (`nvm use 22`).

- **pnpm lockfile version mismatch.** pnpm 8 vs pnpm 10 produce incompatible
  lockfiles. The project uses pnpm 10 lockfile format — installing with pnpm 8
  warns "Ignoring broken lockfile" and regenerates it, polluting git diff.
  Solution: use `pnpm@10` with Node 22.

## Codebase Patterns

- **Inline styles everywhere**, not CSS modules. Each component folder has a
  `styles.ts` exporting a `const s` object. Dynamic styles are functions
  returning `CSSProperties` (e.g. `s.counterChip(active)`).

- **FindingCard borderColor warning** — React warns about mixing `border`
  shorthand with `borderLeftColor`. This is a pre-existing issue in
  `FindingCard/styles.ts` `card()` function. The workaround (all-longhand) is
  already applied but the warning still appears in tests. Not a regression.

- **Findings are nested in `ReviewRecord.findings`**, fetched via
  `usePrReviews(prId)`. There's no separate findings endpoint — always flatMap
  from reviews.

## Decisions

### 2026-06-27 — Severity counters placement

Placed counters in `FindingsPanel` toolbar (per-run), not in `PrDetailHeader`
(PR-wide). Rationale: each `ReviewRunAccordion` has its own `FindingsPanel`, so
counters reflect that specific agent run's findings, which is more actionable
than an aggregate.

## Open Questions

- Should severity counters also appear in the PR list page (PRRow component)
  as a quick summary? The design mockup shows a findings popup on hover.
