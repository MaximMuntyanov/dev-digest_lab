/* PrBriefCard — the "Why + Risk" brief at the top of a PR.
   One structured LLM call assembled from already-built inputs (intent, blast
   summary, diff groups, linked issue, project-context specs), cached per-PR.
   Risk level by color; risks + review-focus link to real files (click → code). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Icon,
  Badge,
  Button,
  MonoLink,
  SectionLabel,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@devdigest/ui";
import type { Brief } from "@devdigest/shared";
import { useBrief, useGenerateBrief } from "../../../../../../../lib/hooks/brief";
import { githubBlobUrl } from "../../../../../../../lib/github-urls";
import { s, riskColors } from "./styles";

interface PrBriefCardProps {
  prId: string | null;
  repoFullName?: string | null;
  headSha?: string | null;
}

function fileHref(repoFullName: string | null | undefined, headSha: string | null | undefined, file: string, line?: number | null) {
  if (!repoFullName || !headSha) return undefined;
  return githubBlobUrl(repoFullName, headSha, file, line ?? undefined);
}

export function PrBriefCard({ prId, repoFullName, headSha }: PrBriefCardProps) {
  const t = useTranslations("brief");
  const { data, isLoading, isError, refetch } = useBrief(prId);
  const generate = useGenerateBrief(prId);

  if (isLoading || generate.isPending) {
    return (
      <section style={s.loadingWrap}>
        <Skeleton height={22} width={280} />
        <Skeleton height={54} />
        <Skeleton height={80} />
      </section>
    );
  }

  if (isError || !data) {
    return <ErrorState title={t("error.title")} body={t("error.body")} onRetry={() => refetch()} />;
  }

  if (data.empty) {
    return <EmptyState icon="FileText" title={t("empty.title")} body={t("empty.body")} />;
  }

  const rc = riskColors(data.risk_level);

  return (
    <section style={s.card}>
      <div style={s.headRow}>
        <SectionLabel icon="Sparkles">{t("title")}</SectionLabel>
        <Badge color={rc.color} bg={rc.bg} icon="Shield">
          {t(`risk.${data.risk_level}`)}
        </Badge>
        <span style={s.headSpacer} />
        <span style={s.meta}>
          {data.cached ? t("meta.cached") : t("meta.fresh")}
          {" · "}
          {t("meta.inputSize", { chars: data.input_chars })}
        </span>
        <Button
          kind="ghost"
          size="sm"
          icon="RefreshCw"
          loading={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {t("regenerate")}
        </Button>
      </div>

      {data.degraded && (
        <div style={s.degradedBanner}>
          <Icon.AlertTriangle size={15} style={{ color: "var(--warn)", flexShrink: 0 }} />
          <span>{t("degraded", { reason: data.degraded_reason ?? data.index_status })}</span>
        </div>
      )}

      {data.what && <div style={s.what}>{data.what}</div>}
      {data.why && (
        <div style={s.why}>
          <strong style={{ color: "var(--text-primary)" }}>{t("why")}: </strong>
          {data.why}
        </div>
      )}

      {data.risks.length > 0 && (
        <div style={s.section}>
          <SectionLabel icon="AlertTriangle">{t("section.risks", { n: data.risks.length })}</SectionLabel>
          {data.risks.map((r, i) => {
            const c = riskColors(r.severity);
            return (
              <div key={`${r.title}:${i}`} style={s.riskRow}>
                <div style={s.riskHead}>
                  <Badge color={c.color} bg={c.bg} dot>
                    {t(`risk.${r.severity}`)}
                  </Badge>
                  <span style={s.riskTitle}>{r.title}</span>
                </div>
                <div style={s.riskExplain}>{r.explanation}</div>
                {r.file_refs.length > 0 && (
                  <div style={s.refRow}>
                    {r.file_refs.map((f) => (
                      <MonoLink key={f} href={fileHref(repoFullName, headSha, f)}>
                        {f}
                      </MonoLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.review_focus.length > 0 && (
        <div style={s.section}>
          <SectionLabel icon="Eye">{t("section.focus", { n: data.review_focus.length })}</SectionLabel>
          {data.review_focus.map((it, i) => (
            <div key={`${it.file}:${it.line ?? ""}:${i}`} style={s.focusRow}>
              <MonoLink href={fileHref(repoFullName, headSha, it.file, it.line)}>
                {it.file}
                {it.line != null ? `:${it.line}` : ""}
              </MonoLink>
              <span style={s.focusReason}>{it.reason}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default PrBriefCard;

export type { Brief };
