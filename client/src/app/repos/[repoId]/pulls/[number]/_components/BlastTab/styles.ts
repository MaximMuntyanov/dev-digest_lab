import type { CSSProperties } from "react";

/** Co-located styles for the Blast Radius tab. */
export const s = {
  summaryBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 20,
  } satisfies CSSProperties,
  statChips: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  statChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    fontSize: 12.5,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  statNum: {
    fontWeight: 700,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  degradedBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    marginBottom: 18,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  symbolCard: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-surface)",
    marginBottom: 10,
    overflow: "hidden",
  } satisfies CSSProperties,
  symbolHead: (clickable: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    cursor: clickable ? "pointer" : "default",
  }),
  symbolName: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  symbolFile: {
    fontSize: 12,
    color: "var(--text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  callerList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "4px 14px 12px 34px",
  } satisfies CSSProperties,
  callerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "5px 0",
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  callerVia: {
    fontSize: 11.5,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  callerSpacer: { flex: 1 } satisfies CSSProperties,
  noCallers: {
    padding: "4px 14px 12px 34px",
    fontSize: 12.5,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  badgeWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  section: {
    marginTop: 26,
  } satisfies CSSProperties,
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } satisfies CSSProperties,
} as const;
