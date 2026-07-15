import type { CSSProperties } from "react";

export const s: Record<string, CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", minHeight: 0 },
  tabsBar: { borderBottom: "1px solid var(--border)", flexShrink: 0 },
  body: { flex: 1, minHeight: 0, overflow: "auto" },

  // config
  form: { padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 },
  formHeader: { display: "flex", alignItems: "center", gap: 12 },
  h2: { fontSize: 15, fontWeight: 700, color: "var(--text-primary)" },
  enabledLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" },
  actions: { display: "flex", alignItems: "center", gap: 12, marginTop: 4 },
  savedNote: { fontSize: 12.5, color: "var(--ok)" },

  // evals
  ewrap: { padding: 24, display: "flex", flexDirection: "column", gap: 20 },
  metricsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  metricCard: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-surface)",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  metricLabel: { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-muted)" },
  metricValue: { fontSize: 26, fontWeight: 700, color: "var(--text-primary)" },
  metricValueMuted: { fontSize: 26, fontWeight: 700, color: "var(--text-muted)" },

  header: { display: "flex", alignItems: "center", gap: 12 },
  spacer: { flex: 1 },

  list: { display: "flex", flexDirection: "column", gap: 6 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-surface)",
  },
  caseName: { fontFamily: "var(--font-mono, monospace)", fontSize: 13, color: "var(--text-primary)" },
  caseMeta: { fontSize: 12, color: "var(--text-muted)" },
  empty: { padding: 20, fontSize: 13, color: "var(--text-secondary)" },

  runsTable: { display: "flex", flexDirection: "column", gap: 4 },
  runRow: {
    display: "grid",
    gridTemplateColumns: "28px 150px 60px 1fr 1fr 1fr 70px 70px",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-surface)",
    fontSize: 12.5,
  },
  runHead: {
    display: "grid",
    gridTemplateColumns: "28px 150px 60px 1fr 1fr 1fr 70px 70px",
    gap: 10,
    padding: "0 12px",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },
  ver: { color: "var(--accent)", fontWeight: 600 },

  compareGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 },
  cmpCard: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  promptDiff: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  promptCol: { display: "flex", flexDirection: "column", gap: 6 },
  promptPre: {
    whiteSpace: "pre-wrap",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 12,
    lineHeight: 1.6,
    color: "var(--text-secondary)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 12,
    maxHeight: 320,
    overflow: "auto",
  },

  addForm: { display: "flex", flexDirection: "column", gap: 14 },
  addRow: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end" },
};

export const cmpDelta = (up: boolean, flat: boolean): CSSProperties => ({
  fontSize: 12,
  fontWeight: 600,
  color: flat ? "var(--text-muted)" : up ? "var(--ok)" : "var(--crit)",
});
