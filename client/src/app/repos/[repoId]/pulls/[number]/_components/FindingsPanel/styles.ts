import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  counterBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  } satisfies CSSProperties,
  counterChip: (active: boolean): CSSProperties => ({
    cursor: "pointer",
    opacity: active ? 1 : 0.55,
    borderRadius: 6,
    outline: active ? "1.5px solid var(--text-muted)" : "1.5px solid transparent",
    transition: "opacity .15s, outline-color .15s",
  }),
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
