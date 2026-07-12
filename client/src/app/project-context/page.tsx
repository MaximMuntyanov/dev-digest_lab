/* /project-context — Project Context reader (L05). Lists every markdown file
   under specs/docs/insights (any depth) in the connected repo clone, with a
   preview pane. These docs are what agents attach in their Context tab and what
   the run-executor injects into the `## Project context` prompt slot. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { SpecFile } from "@devdigest/shared";
import { AppShell } from "../../components/app-shell";
import { useRepos, useContextFiles, useReindexContext } from "../../lib/hooks/core";

function sourceOf(path: string): "specs" | "docs" | "insights" {
  for (const seg of path.split(/[\\/]/)) {
    if (seg === "specs" || seg === "docs" || seg === "insights") return seg;
  }
  return "specs";
}

const SOURCE_COLORS: Record<string, string> = {
  specs: "var(--accent)",
  docs: "#5b8def",
  insights: "#b06be0",
};

export default function ProjectContextPage() {
  const t = useTranslations("context");
  const { data: repos } = useRepos();
  // Prefer a repo that has actually been cloned (its filesystem has the specs).
  const repo = repos?.find((r) => r.clone_path) ?? repos?.[0];
  const repoId = repo?.id;
  const { data: files, isLoading, isError, refetch } = useContextFiles(repoId);
  const reindex = useReindexContext();
  const [selected, setSelected] = React.useState<string | null>(null);

  const crumb = [{ label: repo?.full_name ?? "Workspace" }, { label: t("title") }];

  const active: SpecFile | null =
    (files ?? []).find((f) => f.path === selected) ?? (files ?? [])[0] ?? null;

  return (
    <AppShell crumb={crumb}>
      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* left: file list */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            background: "var(--bg-surface)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.FileText size={18} style={{ color: "var(--accent)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{t("title")}</h1>
            <Button
              kind="secondary"
              size="sm"
              icon="RefreshCw"
              onClick={() => repoId && reindex.mutate(repoId)}
              disabled={!repoId || reindex.isPending}
            >
              {reindex.isPending ? t("indexing") : t("reindex")}
            </Button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 10px 12px" }}>
            {!repoId ? (
              <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                {t("empty.body")}
              </div>
            ) : isLoading ? (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton height={36} />
                <Skeleton height={36} />
                <Skeleton height={36} />
              </div>
            ) : (files?.length ?? 0) === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                <strong>{t("empty.title")}</strong>
                <div style={{ marginTop: 6 }}>{t("empty.body")}</div>
              </div>
            ) : (
              (files ?? []).map((f) => {
                const src = sourceOf(f.path);
                const on = active?.path === f.path;
                return (
                  <button
                    key={f.path}
                    onClick={() => setSelected(f.path)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 10px",
                      borderRadius: 8,
                      border: "1px solid " + (on ? "var(--accent)" : "transparent"),
                      background: on ? "var(--bg-elevated)" : "transparent",
                      cursor: "pointer",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 13,
                        color: "var(--text-primary)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.path}
                    </span>
                    <Badge color={SOURCE_COLORS[src]}>{src}</Badge>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* right: preview */}
        <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          {isError ? (
            <ErrorState
              fullScreen
              title={t("loadError")}
              body={t("loadError")}
              onRetry={() => refetch()}
            />
          ) : active ? (
            <div style={{ padding: 28, maxWidth: 900 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{active.path.split(/[\\/]/).pop()}</h2>
                <Badge color={SOURCE_COLORS[sourceOf(active.path)]}>{sourceOf(active.path)}</Badge>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
                {active.path}
                {active.size != null
                  ? ` · ${t("kb", { kb: Math.max(1, Math.round(active.size / 1024)) })}`
                  : ""}
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  color: "var(--text-secondary)",
                }}
              >
                {active.content ?? ""}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
