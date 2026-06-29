"use client";

import React from "react";
import { Icon, SeverityBadge, Button } from "@devdigest/ui";

const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const;
const SEV_LABEL: Record<string, string> = {
  CRITICAL: "Critical",
  WARNING: "Warning",
  SUGGESTION: "Suggestion",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 99,
};

const popup: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  zIndex: 100,
  marginTop: 6,
  minWidth: 220,
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  boxShadow: "0 8px 24px rgba(0,0,0,.25)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

export function FindingsPopup({
  summary,
  onClose,
  onViewAll,
}: {
  summary: { critical: number; warning: number; suggestion: number };
  onClose: () => void;
  onViewAll: () => void;
}) {
  const total = summary.critical + summary.warning + summary.suggestion;

  return (
    <>
      <div style={overlay} onClick={onClose} />
      <div style={popup} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
          {total} finding{total === 1 ? "" : "s"}
        </div>
        {SEVERITIES.map((sev) => {
          const count = summary[sev.toLowerCase() as keyof typeof summary];
          if (count === 0) return null;
          return (
            <div key={sev} style={row}>
              <SeverityBadge severity={sev} count={count} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{SEV_LABEL[sev]}</span>
            </div>
          );
        })}
        <Button kind="ghost" size="sm" icon="ArrowRight" onClick={onViewAll}>
          View all findings
        </Button>
      </div>
    </>
  );
}
