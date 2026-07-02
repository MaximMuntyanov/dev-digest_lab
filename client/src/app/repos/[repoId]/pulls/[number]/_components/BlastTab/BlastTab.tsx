/* BlastTab — the "what can these changes break?" impact map for a PR.
   Read-only over the repo-intel index (no LLM). Renders in levels:
   changed symbols → callers (click file:line → code) → impacted endpoints. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Icon,
  Badge,
  MonoLink,
  SectionLabel,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@devdigest/ui";
import type { BlastSymbolGroup } from "@devdigest/shared";
import { useBlast } from "../../../../../../../lib/hooks/blast";
import { githubBlobUrl } from "../../../../../../../lib/github-urls";
import { s } from "./styles";

interface BlastTabProps {
  prId: string | null;
  repoFullName?: string | null;
  headSha?: string | null;
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span style={s.statChip}>
      <span style={s.statNum}>{value}</span> {label}
    </span>
  );
}

function SymbolCard({
  group,
  repoFullName,
  headSha,
  defaultOpen,
  noCallersLabel,
}: {
  group: BlastSymbolGroup;
  repoFullName?: string | null;
  headSha?: string | null;
  defaultOpen: boolean;
  noCallersLabel: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const hasCallers = group.callers.length > 0;

  return (
    <div style={s.symbolCard}>
      <div
        role={hasCallers ? "button" : undefined}
        tabIndex={hasCallers ? 0 : undefined}
        onClick={() => hasCallers && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (hasCallers && (e.key === "Enter" || e.key === " ")) setOpen((o) => !o);
        }}
        style={s.symbolHead(hasCallers)}
      >
        <Icon.Code size={14} style={{ color: "var(--accent-text)", flexShrink: 0 }} />
        <span className="mono" style={s.symbolName}>
          {group.name}
        </span>
        <Badge color="var(--text-muted)" bg="transparent">
          {group.kind}
        </Badge>
        <span className="mono" style={s.symbolFile}>
          {group.file}
        </span>
        <span style={s.callerSpacer} />
        <Badge color="var(--text-secondary)" bg="var(--bg-hover)">
          {group.callers.length}
        </Badge>
        {hasCallers && (
          <Icon.ChevronDown
            size={15}
            style={{
              color: "var(--text-muted)",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .15s",
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {!hasCallers && <div style={s.noCallers}>{noCallersLabel}</div>}

      {open && hasCallers && (
        <div style={s.callerList}>
          {group.callers.map((c, i) => {
            const href =
              repoFullName && headSha
                ? githubBlobUrl(repoFullName, headSha, c.file, c.line)
                : undefined;
            return (
              <div key={`${c.file}:${c.line}:${i}`} style={s.callerRow}>
                <Icon.CornerDownRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <MonoLink href={href}>
                  {c.file}:{c.line}
                </MonoLink>
                {c.symbol && <span style={s.callerVia}>in {c.symbol}()</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BlastTab({ prId, repoFullName, headSha }: BlastTabProps) {
  const t = useTranslations("blast");
  const { data, isLoading, isError, refetch } = useBlast(prId);

  if (isLoading) {
    return (
      <section style={s.loadingWrap}>
        <Skeleton height={20} width={320} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState title={t("error.title")} body={t("error.body")} onRetry={() => refetch()} />
    );
  }

  const hasData = data.changed_symbols.length > 0 || data.endpoints.length > 0;
  if (!hasData) {
    return <EmptyState icon="Zap" title={t("empty.title")} body={t("empty.body")} />;
  }

  // Expand symbols that actually have callers so the map reads at a glance.
  const symbolsWithCallers = data.symbols.filter((g) => g.callers.length > 0).length;

  return (
    <section>
      <div style={s.summaryBar}>
        <div style={s.statChips}>
          <StatChip label={t("stat.symbols")} value={data.counts.symbols} />
          <StatChip label={t("stat.callers")} value={data.counts.callers} />
          <StatChip label={t("stat.endpoints")} value={data.counts.endpoints} />
          {data.counts.crons > 0 && <StatChip label={t("stat.crons")} value={data.counts.crons} />}
        </div>
      </div>

      {data.degraded && (
        <div style={s.degradedBanner}>
          <Icon.AlertTriangle size={15} style={{ color: "var(--warn)", flexShrink: 0 }} />
          <span>
            {data.index_status === "partial" ? t("degraded.partial") : t("degraded.degraded")}
            {data.reason ? ` (${t("degraded.reason", { reason: data.reason })})` : ""}
          </span>
        </div>
      )}

      <SectionLabel icon="GitBranch">{t("section.symbols")}</SectionLabel>
      {data.symbols.length === 0 ? (
        <div style={s.noCallers}>{t("noCallers")}</div>
      ) : (
        data.symbols.map((group, i) => (
          <SymbolCard
            key={`${group.file}:${group.name}:${i}`}
            group={group}
            repoFullName={repoFullName}
            headSha={headSha}
            defaultOpen={symbolsWithCallers <= 4}
            noCallersLabel={t("noCallers")}
          />
        ))
      )}

      {data.endpoints.length > 0 && (
        <div style={s.section}>
          <SectionLabel icon="Globe">{t("section.endpoints")}</SectionLabel>
          <div style={s.badgeWrap}>
            {data.endpoints.map((ep) => (
              <Badge key={ep} mono color="var(--accent-text)" bg="var(--accent-bg)">
                {ep}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {data.crons.length > 0 && (
        <div style={s.section}>
          <SectionLabel icon="Clock">{t("section.crons")}</SectionLabel>
          <div style={s.badgeWrap}>
            {data.crons.map((cron) => (
              <Badge key={cron} mono color="var(--warn)" bg="var(--warn-bg)">
                {cron}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default BlastTab;
