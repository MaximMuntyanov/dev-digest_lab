import type { CSSProperties } from "react";

export const s: Record<string, CSSProperties> = {
  wrap: { padding: 28, display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 },
  header: { display: "flex", alignItems: "center", gap: 12 },
  h2: { fontSize: 16, fontWeight: 700 },
  help: { fontSize: 13, color: "var(--text-secondary)" },
  filterWrap: { marginLeft: "auto", width: 260 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-surface)",
  },
  rowActive: { borderColor: "var(--accent)", background: "var(--bg-elevated)" },
  handle: { color: "var(--text-muted)", cursor: "grab", fontSize: 16, userSelect: "none" },
  name: { fontFamily: "var(--font-mono, monospace)", fontSize: 13, fontWeight: 600 },
  dir: { fontSize: 12, color: "var(--text-muted)" },
  spacer: { flex: 1 },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingTop: 6,
    borderTop: "1px solid var(--border)",
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  actions: { display: "flex", alignItems: "center", gap: 12, marginTop: 4 },
  savedNote: { fontSize: 13, color: "var(--text-secondary)" },
  previewBody: { padding: 20, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, lineHeight: 1.6 },
  empty: { fontSize: 14, color: "var(--text-secondary)", padding: "24px 0" },
};

const SOURCE_COLORS: Record<string, string> = {
  specs: "var(--accent)",
  docs: "#5b8def",
  insights: "#b06be0",
};

export function sourceColor(src: string): string {
  return SOURCE_COLORS[src] ?? "var(--text-secondary)";
}
