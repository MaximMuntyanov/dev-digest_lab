import type { CSSProperties } from "react";

/** Co-located styles for the PR Why+Risk Brief card. */
export const s = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "var(--bg-surface)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } satisfies CSSProperties,
  headRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  headSpacer: { flex: 1 } satisfies CSSProperties,
  meta: {
    fontSize: 11.5,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  what: {
    fontSize: 14.5,
    fontWeight: 600,
    color: "var(--text-primary)",
    lineHeight: 1.5,
  } satisfies CSSProperties,
  why: {
    fontSize: 13.5,
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  } satisfies CSSProperties,
  degradedBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 13px",
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    fontSize: 12.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
  riskRow: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  riskHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  riskTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  riskExplain: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  } satisfies CSSProperties,
  refRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 2,
  } satisfies CSSProperties,
  focusRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    padding: "6px 0",
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  focusReason: {
    fontSize: 12.5,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } satisfies CSSProperties,
} as const;

/** Risk-level → color tokens (never color-only: paired with a label). */
export function riskColors(level: "high" | "medium" | "low"): { color: string; bg: string } {
  if (level === "high") return { color: "var(--crit)", bg: "var(--crit-bg)" };
  if (level === "medium") return { color: "var(--warn)", bg: "var(--warn-bg)" };
  return { color: "var(--ok, var(--accent-text))", bg: "var(--ok-bg, var(--accent-bg))" };
}
