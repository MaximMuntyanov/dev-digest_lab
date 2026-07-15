/* /skills — Skills Lab list. Grid of skills + "Add skill" modal. A skill is a
   reusable review rubric; open one to edit it and run its evals. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Icon,
  Modal,
  SelectInput,
  Skeleton,
  TextInput,
  Textarea,
} from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "../../components/app-shell";
import { useSkills, useCreateSkill } from "../../lib/hooks/skills";
import { useToast } from "../../lib/toast";

const TYPE_OPTIONS = [
  { value: "rubric", label: "Rubric" },
  { value: "convention", label: "Convention" },
  { value: "security", label: "Security" },
  { value: "custom", label: "Custom" },
];

const TYPE_COLOR: Record<string, string> = {
  rubric: "var(--accent)",
  convention: "#3a9",
  security: "var(--crit)",
  custom: "var(--text-secondary)",
};

export default function SkillsPage() {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  const crumb = [{ label: t("list.breadcrumbLab") }, { label: t("list.breadcrumb") }];

  const filtered = (skills ?? []).filter((s) =>
    query.trim() ? s.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  if (isError) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState fullScreen title={t("list.loadError")} onRetry={() => refetch()} />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon.Sparkles size={20} style={{ color: "var(--accent)" }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t("list.title")}</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              {t("list.subtitle")}
            </p>
          </div>
          <Button kind="primary" icon="Plus" onClick={() => setCreateOpen(true)}>
            {t("list.add")}
          </Button>
        </div>

        <div style={{ maxWidth: 360 }}>
          <TextInput value={query} onChange={setQuery} placeholder={t("list.search")} />
        </div>

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={120} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Sparkles" title={t("list.empty")} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map((sk) => (
              <SkillCard key={sk.id} skill={sk} onOpen={() => router.push(`/skills/${sk.id}?tab=config`)} />
            ))}
          </div>
        )}
      </div>

      {createOpen && <CreateSkillModal onClose={() => setCreateOpen(false)} />}
    </AppShell>
  );
}

function SkillCard({ skill, onOpen }: { skill: Skill; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: "left",
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--bg-surface)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{skill.name}</span>
        <Badge color={TYPE_COLOR[skill.type] ?? "var(--text-secondary)"}>{skill.type}</Badge>
      </div>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {skill.description}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <Badge color="var(--text-muted)" mono>
          v{skill.version}
        </Badge>
        {!skill.enabled && <Badge color="var(--text-muted)">disabled</Badge>}
      </div>
    </button>
  );
}

function CreateSkillModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<Skill["type"]>("rubric");
  const [body, setBody] = React.useState("");

  const submit = () =>
    create.mutate(
      { name, description, type, body },
      {
        onSuccess: (sk) => {
          onClose();
          router.push(`/skills/${sk.id}?tab=config`);
        },
        onError: () => toast.error(t("create.title")),
      },
    );

  const valid = name.trim() && description.trim() && body.trim();

  return (
    <Modal title={t("create.title")} width={620} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormField label={t("create.name")} required>
          <TextInput value={name} onChange={setName} />
        </FormField>
        <FormField label={t("create.description")} required>
          <TextInput value={description} onChange={setDescription} />
        </FormField>
        <FormField label={t("create.type")}>
          <SelectInput value={type} onChange={(v) => setType(v as Skill["type"])} options={TYPE_OPTIONS} />
        </FormField>
        <FormField label={t("create.body")} required>
          <Textarea value={body} onChange={setBody} rows={8} mono placeholder={t("create.bodyPlaceholder")} />
        </FormField>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button kind="secondary" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
