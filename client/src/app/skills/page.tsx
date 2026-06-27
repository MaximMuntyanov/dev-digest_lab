/* Skills — /skills. List imported and extracted skills; expand to preview body. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Skeleton,
  ErrorState,
  Dropdown,
  Toggle,
  Markdown,
  Modal,
  FormField,
  TextInput,
  Textarea,
  Icon,
} from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill } from "@/lib/hooks";

function typeBadgeColor(type: SkillType): string {
  switch (type) {
    case "security":
      return "var(--crit)";
    case "rubric":
      return "var(--accent)";
    case "convention":
      return "var(--ok)";
    default:
      return "var(--text-secondary)";
  }
}

function SkillCard({
  skill,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onDelete,
  deleting,
  t,
}: {
  skill: Skill;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onDelete: () => void;
  deleting: boolean;
  t: ReturnType<typeof useTranslations<"skills">>;
}) {
  const typeKey = `listItem.type.${skill.type}` as const;
  const sourceKey = `listItem.source.${skill.source}` as const;

  return (
    <Card hover onClick={onToggleExpand} style={s.card(expanded, skill.enabled)}>
      <div style={s.cardHeader}>
        <div style={s.cardMain}>
          <span style={s.name}>{skill.name}</span>
          <div style={s.badges}>
            <Badge color={typeBadgeColor(skill.type as SkillType)} mono>
              {t(typeKey)}
            </Badge>
            <Badge color="var(--text-muted)" bg="var(--bg-hover)">
              {t(sourceKey)}
            </Badge>
            <span className="mono" style={s.version}>
              {t("preview.version", { version: skill.version })}
            </span>
          </div>
        </div>
        <div style={s.cardActions} onClick={(e) => e.stopPropagation()}>
          <Toggle on={skill.enabled} onChange={onToggleEnabled} size={14} />
          <button
            onClick={onDelete}
            disabled={deleting}
            title="Delete skill"
            aria-label="Delete skill"
            style={s.deleteBtn}
          >
            <Icon.Trash
              size={14}
              style={deleting ? { animation: "ddspin 1s linear infinite" } : undefined}
            />
          </button>
          <Icon.ChevronDown size={16} style={s.chevron(expanded)} />
        </div>
      </div>

      {skill.description && !expanded && (
        <p style={s.description}>{skill.description}</p>
      )}

      {expanded && (
        <div style={s.body} onClick={(e) => e.stopPropagation()}>
          {skill.description && <p style={s.descriptionExpanded}>{skill.description}</p>}
          <div style={s.markdown}>
            <Markdown>{skill.body}</Markdown>
          </div>
        </div>
      )}
    </Card>
  );
}

function CreateSkillModal({
  onClose,
  t,
}: {
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"skills">>;
}) {
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [body, setBody] = React.useState("");
  const [importUrl, setImportUrl] = React.useState("");
  const [importing, setImporting] = React.useState(false);

  const fetchFromUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      let url = importUrl.trim();
      if (url.includes("github.com") && url.includes("/blob/")) {
        url = url
          .replace("github.com", "raw.githubusercontent.com")
          .replace("/blob/", "/");
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setBody(text);
      if (!name) {
        const fileName = url.split("/").pop()?.replace(/\.\w+$/, "") ?? "imported";
        setName(fileName);
      }
    } catch {
      alert("Failed to fetch URL. Check the URL and try again.");
    } finally {
      setImporting(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !body.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || name.trim(),
      type: "custom",
      source: importUrl ? "imported_url" : "manual",
      body: body.trim(),
    });
    onClose();
  };

  return (
    <Modal
      width={640}
      title="Add Skill"
      subtitle="Create manually or import from URL"
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button
            kind="primary"
            icon="Plus"
            onClick={submit}
            disabled={create.isPending || !name.trim() || !body.trim()}
          >
            {create.isPending ? "Creating..." : "Create Skill"}
          </Button>
        </div>
      }
    >
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <FormField label="Import from URL">
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput
              value={importUrl}
              onChange={setImportUrl}
              placeholder="https://raw.githubusercontent.com/..."
            />
            <Button kind="secondary" size="sm" onClick={fetchFromUrl} disabled={importing || !importUrl.trim()}>
              {importing ? "Loading..." : "Fetch"}
            </Button>
          </div>
        </FormField>
        <FormField label="Name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. breaking-change" />
        </FormField>
        <FormField label="Description">
          <TextInput value={description} onChange={setDescription} placeholder="What does this skill check?" />
        </FormField>
        <FormField label="Body (markdown)" required>
          <Textarea value={body} onChange={setBody} rows={10} placeholder="# Skill directive..." />
        </FormField>
      </div>
    </Modal>
  );
}

export default function SkillsPage() {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const del = useDeleteSkill();

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const list = skills ?? [];

  const handleDelete = async (skill: Skill) => {
    if (!window.confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) return;
    setDeletingId(skill.id);
    try {
      await del.mutateAsync(skill.id);
      if (expandedId === skill.id) setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {createOpen && <CreateSkillModal onClose={() => setCreateOpen(false)} t={t} />}
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("page.heading")}</h1>
          </div>
          <Dropdown
            width={240}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setCreateOpen(true) },
              { label: t("page.menu.fromUrl"), icon: "Link", onClick: () => setCreateOpen(true) },
              { divider: true },
              { label: t("page.menu.community"), icon: "Search", muted: true },
            ]}
          />
        </div>

        {isLoading && (
          <div style={s.list}>
            <Skeleton height={88} />
            <Skeleton height={88} />
            <Skeleton height={88} />
          </div>
        )}

        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}

        {!isLoading && !isError && list.length === 0 && (
          <EmptyState
            icon="BookOpen"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
          />
        )}

        {list.length > 0 && (
          <div style={s.list}>
            {list.map((skill) => (
              <SkillCardWrapper
                key={skill.id}
                skill={skill}
                expanded={expandedId === skill.id}
                onToggleExpand={() =>
                  setExpandedId((id) => (id === skill.id ? null : skill.id))
                }
                onDelete={() => handleDelete(skill)}
                deleting={deletingId === skill.id}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Wrapper so each card gets its own useUpdateSkill hook instance. */
function SkillCardWrapper({
  skill,
  expanded,
  onToggleExpand,
  onDelete,
  deleting,
  t,
}: {
  skill: Skill;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  deleting: boolean;
  t: ReturnType<typeof useTranslations<"skills">>;
}) {
  const update = useUpdateSkill(skill.id);

  const onToggleEnabled = async (enabled: boolean) => {
    await update.mutateAsync({ enabled });
  };

  return (
    <SkillCard
      skill={skill}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onToggleEnabled={onToggleEnabled}
      onDelete={onDelete}
      deleting={deleting}
      t={t}
    />
  );
}

const s = {
  page: { padding: "24px 32px 44px", maxWidth: 860, margin: "0 auto" } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 20,
  } satisfies CSSProperties,
  headerText: { flex: 1 } satisfies CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  card: (expanded: boolean, enabled: boolean): CSSProperties => ({
    opacity: enabled ? 1 : 0.72,
    borderColor: expanded ? "var(--border-strong)" : undefined,
  }),
  cardHeader: { display: "flex", alignItems: "flex-start", gap: 12 } satisfies CSSProperties,
  cardMain: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  name: { fontSize: 15, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  badges: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 } satisfies CSSProperties,
  version: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  cardActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 } satisfies CSSProperties,
  deleteBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-muted)",
    display: "inline-flex",
    padding: 4,
  } satisfies CSSProperties,
  chevron: (expanded: boolean): CSSProperties => ({
    color: "var(--text-muted)",
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform .15s ease",
  }),
  description: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginTop: 8,
    lineHeight: 1.45,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  descriptionExpanded: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 12,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  body: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  markdown: { fontSize: 14, color: "var(--text-primary)", lineHeight: 1.55 } satisfies CSSProperties,
} as const;
