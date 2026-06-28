"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { Badge, SectionLabel } from "@devdigest/ui";
import type { SmartDiff, SmartDiffGroup, SmartDiffFile, PrFile } from "@devdigest/shared";
import { DiffViewer } from "../diff-viewer";

const ROLE_CONFIG = {
  core: {
    color: "var(--accent-text)",
    bg: "var(--accent-bg)",
    icon: "Code" as const,
    defaultOpen: true,
  },
  wiring: {
    color: "var(--text-secondary)",
    bg: "var(--bg-hover)",
    icon: "Settings" as const,
    defaultOpen: true,
  },
  boilerplate: {
    color: "var(--text-muted)",
    bg: "var(--bg-surface)",
    icon: "Package" as const,
    defaultOpen: false,
  },
} as const;

interface SmartDiffViewerProps {
  smartDiff: SmartDiff;
  /** Full PR files with patches for rendering actual diffs. */
  prFiles: PrFile[];
}

export function SmartDiffViewer({ smartDiff, prFiles }: SmartDiffViewerProps) {
  const t = useTranslations("prReview.smartDiff");
  const fileMap = React.useMemo(() => {
    const map = new Map<string, PrFile>();
    for (const f of prFiles) map.set(f.path, f);
    return map;
  }, [prFiles]);

  return (
    <div>
      <SectionLabel icon="Layers">{t("groupedByRole")}</SectionLabel>

      {smartDiff.split_suggestion.too_big && (
        <SplitSuggestion
          totalLines={smartDiff.split_suggestion.total_lines}
          splits={smartDiff.split_suggestion.proposed_splits}
          t={t}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
        {smartDiff.groups.map((group) => (
          <RoleGroup key={group.role} group={group} fileMap={fileMap} t={t} />
        ))}
      </div>
    </div>
  );
}

function SplitSuggestion({
  totalLines,
  splits,
  t,
}: {
  totalLines: number;
  splits: { name: string; files: string[] }[];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      style={{
        margin: "12px 0",
        padding: "14px 18px",
        borderRadius: 8,
        border: "1px solid var(--warn-bg)",
        background: "var(--warn-bg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon.AlertTriangle size={16} style={{ color: "var(--warn)" }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--warn)" }}>
          {t("largeTitle", { lines: totalLines })}
        </span>
      </div>
      {splits.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px" }}>
            {t("largeBody")}
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)" }}>
            {splits.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>: {s.files.length} files
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RoleGroup({
  group,
  fileMap,
  t,
}: {
  group: SmartDiffGroup;
  fileMap: Map<string, PrFile>;
  t: ReturnType<typeof useTranslations>;
}) {
  const config = ROLE_CONFIG[group.role];
  const [open, setOpen] = React.useState(config.defaultOpen);

  const totalFindings = group.files.reduce((s, f) => s + f.finding_lines.length, 0);
  const labelKey = `${group.role}Label` as const;

  const groupFiles: PrFile[] = group.files
    .map((sf) => fileMap.get(sf.path))
    .filter((f): f is PrFile => !!f);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--bg-elevated)",
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          cursor: "pointer",
          background: config.bg,
        }}
      >
        <Icon.ChevronRight
          size={14}
          style={{
            color: config.color,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform .12s",
          }}
        />
        {React.createElement(Icon[config.icon], { size: 15, style: { color: config.color } })}
        <span style={{ fontWeight: 600, fontSize: 14, color: config.color }}>
          {t(labelKey)}
        </span>
        <Badge color={config.color} bg="transparent" mono>
          {t("filesCount", { count: group.files.length })}
        </Badge>
        {totalFindings > 0 && (
          <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle" mono>
            {t("findingLines", { count: totalFindings })}
          </Badge>
        )}
      </div>

      {open && (
        <div style={{ padding: "8px 12px 12px" }}>
          {group.files.map((sf) => (
            <SmartDiffFileCard key={sf.path} file={sf} prFile={fileMap.get(sf.path)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SmartDiffFileCard({
  file,
  prFile,
}: {
  file: SmartDiffFile;
  prFile?: PrFile;
}) {
  const [showDiff, setShowDiff] = React.useState(false);

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "8px 0",
      }}
    >
      <div
        onClick={() => setShowDiff((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          padding: "4px 0",
        }}
      >
        <Icon.ChevronRight
          size={12}
          style={{
            color: "var(--text-muted)",
            transform: showDiff ? "rotate(90deg)" : "none",
            transition: "transform .12s",
          }}
        />
        <Icon.FileText size={13} style={{ color: "var(--text-muted)" }} />
        <span className="mono" style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file.path}
        </span>
        <span className="mono tnum" style={{ fontSize: 12 }}>
          <span style={{ color: "var(--code-add-text)" }}>+{file.additions}</span>{" "}
          <span style={{ color: "var(--code-del-text)" }}>−{file.deletions}</span>
        </span>
        {file.finding_lines.length > 0 && (
          <FindingsBadge count={file.finding_lines.length} lines={file.finding_lines} />
        )}
      </div>

      {showDiff && prFile && (
        <div style={{ marginTop: 6, marginLeft: 20 }}>
          <DiffViewer files={[prFile]} />
        </div>
      )}
    </div>
  );
}

function FindingsBadge({ count, lines }: { count: number; lines: number[] }) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        onClick={(e) => {
          e.stopPropagation();
          const firstLine = lines[0];
          if (firstLine == null) return;
          const el = document.querySelector(`[data-line="${firstLine}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 5,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--warn)",
          background: "var(--warn-bg)",
          cursor: "pointer",
        }}
      >
        <Icon.AlertTriangle size={11} />
        {count} finding{count !== 1 ? "s" : ""}
      </span>
      {showTooltip && lines.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 6,
            padding: "6px 10px",
            borderRadius: 6,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          Lines: {lines.slice(0, 10).join(", ")}
          {lines.length > 10 ? ` +${lines.length - 10} more` : ""}
        </div>
      )}
    </span>
  );
}
