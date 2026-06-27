"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Badge, EmptyState, Skeleton, Icon, Toggle } from "@devdigest/ui";
import type { Agent, Skill } from "@devdigest/shared";
import { useSkills, useAgentSkills, useSetAgentSkills } from "@/lib/hooks";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: allSkills, isLoading: loadingSkills } = useSkills();
  const { data: links, isLoading: loadingLinks } = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills(agent.id);

  const linkedIds = React.useMemo(
    () => new Set((links ?? []).map((l) => l.skill_id)),
    [links],
  );

  const toggle = async (skillId: string) => {
    const current = (links ?? []).map((l) => l.skill_id);
    const next = linkedIds.has(skillId)
      ? current.filter((id) => id !== skillId)
      : [...current, skillId];
    await setSkills.mutateAsync(next);
  };

  const list = allSkills ?? [];
  const loading = loadingSkills || loadingLinks;

  return (
    <div style={s.wrap}>
      <p style={s.subtitle}>
        Toggle skills on/off to include their directives in this agent&apos;s review prompt.
      </p>

      {loading ? (
        <div style={s.list}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="BookOpen"
          title="No skills yet"
          body="Create skills on the Skills page first, then link them here."
        />
      ) : (
        <div style={s.list}>
          {list.map((skill) => {
            const linked = linkedIds.has(skill.id);
            return (
              <Card key={skill.id} style={s.card(linked)}>
                <div style={s.row}>
                  <div style={s.info}>
                    <span style={s.name}>{skill.name}</span>
                    <span style={s.desc}>{skill.description}</span>
                  </div>
                  <div style={s.actions}>
                    <Badge
                      color={linked ? "var(--ok)" : "var(--text-muted)"}
                      bg={linked ? "color-mix(in srgb, var(--ok) 12%, transparent)" : "var(--bg-hover)"}
                    >
                      {linked ? "Linked" : "Not linked"}
                    </Badge>
                    <Toggle
                      on={linked}
                      onChange={() => toggle(skill.id)}
                      size={14}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {setSkills.isPending && (
        <p style={s.saving}>Saving...</p>
      )}
    </div>
  );
}

const s = {
  wrap: { padding: "20px 24px" } satisfies CSSProperties,
  subtitle: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 16,
    lineHeight: 1.5,
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  card: (linked: boolean): CSSProperties => ({
    opacity: linked ? 1 : 0.7,
    borderColor: linked ? "color-mix(in srgb, var(--ok) 30%, var(--border))" : undefined,
    transition: "opacity .15s, border-color .15s",
  }),
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,
  info: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: 1,
    minWidth: 0,
  } satisfies CSSProperties,
  name: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  desc: {
    fontSize: 12,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 } satisfies CSSProperties,
  saving: { fontSize: 12, color: "var(--text-muted)", marginTop: 10 } satisfies CSSProperties,
} as const;
