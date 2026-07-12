"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Checkbox, Modal, TextInput } from "@devdigest/ui";
import type { Agent, SpecFile } from "@devdigest/shared";
import { useUpdateAgent } from "../../../../../../../lib/hooks/agents";
import { useRepos, useContextFiles } from "../../../../../../../lib/hooks/core";
import { useToast } from "../../../../../../../lib/toast";
import { s, sourceColor } from "./styles";

/** The specs/docs/insights segment a repo-relative path belongs to (for the badge). */
function sourceOf(path: string): string {
  for (const seg of path.split(/[\\/]/)) {
    if (seg === "specs" || seg === "docs" || seg === "insights") return seg;
  }
  return "specs";
}

/** Rough token estimate for the attach footer (≈4 chars/token). */
function estimateTokens(files: SpecFile[]): number {
  const chars = files.reduce((n, f) => n + (f.content?.length ?? 0), 0);
  return Math.round(chars / 4);
}

/**
 * Context tab — manually attach project-context markdown (specs/docs/insights)
 * to this agent. Mirrors the Skills tab pattern: handle + checkbox + name +
 * source badge + Filter + Preview. Stores repo-relative PATHS on the agent
 * (`context_paths`); the run-executor reads them and injects an untrusted
 * `## Project context` block at run time (zero new LLM calls).
 */
export function ContextTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const toast = useToast();
  const update = useUpdateAgent();

  const { data: repos } = useRepos();
  // Prefer a repo that has actually been cloned (its filesystem has the specs).
  const repoId = (repos?.find((r) => r.clone_path) ?? repos?.[0])?.id;
  const { data: files, isLoading, isError } = useContextFiles(repoId);

  // Local ordered selection (attached first, in this order).
  const [selected, setSelected] = React.useState<string[]>(agent.context_paths ?? []);
  const [filter, setFilter] = React.useState("");
  const [preview, setPreview] = React.useState<SpecFile | null>(null);

  React.useEffect(() => {
    setSelected(agent.context_paths ?? []);
  }, [agent.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const byPath = React.useMemo(() => {
    const m = new Map<string, SpecFile>();
    for (const f of files ?? []) m.set(f.path, f);
    return m;
  }, [files]);

  // Attached (in saved order) first, then the rest alphabetically.
  const ordered = React.useMemo(() => {
    const all = files ?? [];
    const attached = selected.map((p) => byPath.get(p)).filter((f): f is SpecFile => !!f);
    const rest = all.filter((f) => !selected.includes(f.path));
    return [...attached, ...rest];
  }, [files, selected, byPath]);

  const visible = ordered.filter((f) => f.path.toLowerCase().includes(filter.trim().toLowerCase()));

  const toggle = (path: string) =>
    setSelected((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));

  const attachedFiles = selected.map((p) => byPath.get(p)).filter((f): f is SpecFile => !!f);
  const dirty = JSON.stringify(selected) !== JSON.stringify(agent.context_paths ?? []);

  const save = () =>
    update.mutate(
      { id: agent.id, patch: { context_paths: selected } },
      { onSuccess: (data) => toast.success(t("context.savedToast", { version: data.version })) },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("context.title")}</h2>
        <Badge color="var(--accent)">
          {t("context.attached", { count: selected.length, total: files?.length ?? 0 })}
        </Badge>
        <div style={s.filterWrap}>
          <TextInput value={filter} onChange={setFilter} placeholder={t("context.filter")} />
        </div>
      </div>
      <div style={s.help}>{t("context.help")}</div>

      {!repoId ? (
        <div style={s.empty}>{t("context.noRepo")}</div>
      ) : isError ? (
        <div style={s.empty}>{t("context.loadError")}</div>
      ) : isLoading ? (
        <div style={s.empty}>…</div>
      ) : (files?.length ?? 0) === 0 ? (
        <div style={s.empty}>{t("context.empty")}</div>
      ) : (
        <div style={s.list}>
          {visible.map((f) => {
            const on = selected.includes(f.path);
            const src = sourceOf(f.path);
            return (
              <div key={f.path} style={{ ...s.row, ...(on ? s.rowActive : {}) }}>
                <span style={s.handle} aria-hidden>
                  ☰
                </span>
                <Checkbox checked={on} onChange={() => toggle(f.path)} />
                <span style={s.name}>{f.path.split(/[\\/]/).pop()}</span>
                <span style={s.dir}>{f.path}</span>
                <span style={s.spacer} />
                <Badge color={sourceColor(src)}>{src}</Badge>
                <Button kind="ghost" size="sm" icon="Eye" onClick={() => setPreview(f)}>
                  {t("context.preview")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div style={s.footer}>
        <span>{t("context.tokens", { tokens: estimateTokens(attachedFiles) })}</span>
        <span style={s.spacer} />
        <span>{t("context.footNote")}</span>
      </div>

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending || !dirty}>
          {update.isPending ? t("context.saving") : t("context.save")}
        </Button>
        {update.isSuccess && !dirty && <span style={s.savedNote}>✓</span>}
      </div>

      {preview && (
        <Modal
          title={preview.path.split(/[\\/]/).pop()}
          subtitle={preview.path}
          width={760}
          onClose={() => setPreview(null)}
        >
          <div style={s.previewBody}>{preview.content ?? ""}</div>
        </Modal>
      )}
    </div>
  );
}
