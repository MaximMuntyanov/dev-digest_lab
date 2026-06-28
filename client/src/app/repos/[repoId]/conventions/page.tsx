/* Conventions — /repos/:repoId/conventions. Scan repo for house-rules,
   review candidates with evidence, accept/reject, create a Skill. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Skeleton,
  ErrorState,
  Modal,
  FormField,
  TextInput,
  PercentProgress,
  MonoLink,
  Icon,
} from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import {
  useConventions,
  useExtractConventions,
  useUpdateConvention,
  useCreateSkillFromConventions,
} from "@/lib/hooks";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { githubBlobUrl } from "@/lib/github-urls";
import { ApiError } from "@/lib/api";

function mergeAcceptedBody(candidates: ConventionCandidate[]): string {
  const accepted = candidates.filter((c) => c.accepted);
  if (accepted.length === 0) return "";
  return accepted
    .map(
      (c, i) =>
        `## ${i + 1}. ${c.rule}\n\n\`\`\`\n${c.evidence_snippet.trim()}\n\`\`\`\n\n_Source: \`${c.evidence_path}\`_`,
    )
    .join("\n\n");
}

function ConventionCard({
  c,
  repoFullName,
  defaultBranch,
  pending,
  onAccept,
  onReject,
  t,
}: {
  c: ConventionCandidate;
  repoFullName: string;
  defaultBranch: string;
  pending: boolean;
  onAccept: () => void;
  onReject: () => void;
  t: ReturnType<typeof useTranslations<"conventions">>;
}) {
  const fileHref = githubBlobUrl(repoFullName, defaultBranch, c.evidence_path);
  const pct = Math.round(c.confidence * 100);

  return (
    <Card style={s.card(c.accepted)}>
      <div style={s.rule}>{c.rule}</div>

      <div style={s.evidenceBlock}>
        <MonoLink href={fileHref}>{c.evidence_path}</MonoLink>
        <pre style={s.snippet}>{c.evidence_snippet}</pre>
      </div>

      <div style={s.confidenceRow}>
        <span style={s.confidenceLabel}>{t("card.confidence")}</span>
        <div style={s.confidenceBar}>
          <PercentProgress value={pct} color={c.accepted ? "var(--ok)" : "var(--accent)"} />
        </div>
      </div>

      <div style={s.actions}>
        <Button
          kind="secondary"
          size="sm"
          icon="Check"
          active={c.accepted}
          disabled={pending}
          loading={pending && !c.accepted}
          onClick={onAccept}
          style={c.accepted ? s.acceptBtn : undefined}
        >
          {pending && !c.accepted ? t("card.accepting") : t("card.accepted")}
        </Button>
        <Button kind="ghost" size="sm" icon="X" disabled={pending} onClick={onReject}>
          Reject
        </Button>
      </div>
    </Card>
  );
}

function CreateSkillModal({
  repoId,
  repoName,
  accepted,
  onClose,
  t,
}: {
  repoId: string;
  repoName: string;
  accepted: ConventionCandidate[];
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"conventions">>;
}) {
  const router = useRouter();
  const create = useCreateSkillFromConventions(repoId);
  const [name, setName] = React.useState(`${repoName} conventions`);
  const [description, setDescription] = React.useState(
    `Coding conventions extracted from ${repoName}`,
  );
  const preview = React.useMemo(() => mergeAcceptedBody(accepted), [accepted]);

  const submit = async () => {
    await create.mutateAsync({
      repo_id: repoId,
      name: name.trim() || `${repoName} conventions`,
      description: description.trim() || undefined,
    });
    onClose();
    router.push("/skills");
  };

  return (
    <Modal
      width={640}
      title={t("card.acceptAsSkill")}
      subtitle={`${accepted.length} accepted ${accepted.length === 1 ? "rule" : "rules"}`}
      onClose={onClose}
      footer={
        <div style={s.modalFooter}>
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" icon="Sparkles" onClick={submit} disabled={create.isPending}>
            {create.isPending ? t("card.accepting") : t("card.acceptAsSkill")}
          </Button>
        </div>
      }
    >
      <div style={s.modalBody}>
        <FormField label="Name" required>
          <TextInput value={name} onChange={setName} />
        </FormField>
        <FormField label="Description">
          <TextInput value={description} onChange={setDescription} />
        </FormField>
        <FormField label="Preview">
          <pre style={s.preview}>{preview}</pre>
        </FormField>
      </div>
    </Modal>
  );
}

export default function ConventionsPage() {
  const t = useTranslations("conventions");
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);

  const { data: conventions, isLoading, isError, error, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const repoName = activeRepo?.full_name ?? repoId ?? t("page.repoFallback");
  const repoFullName = activeRepo?.full_name ?? repoName;
  const defaultBranch = activeRepo?.default_branch ?? "main";

  const list = conventions ?? [];
  const acceptedList = list.filter((c) => c.accepted);
  const acceptedCount = acceptedList.length;

  const runExtract = () => extract.mutate();

  const setAccepted = async (id: string, accepted: boolean) => {
    setPendingId(id);
    try {
      await update.mutateAsync({ id, accepted });
    } finally {
      setPendingId(null);
    }
  };

  if (repoNotFound) {
    return (
      <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
        <RepoNotFound />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
      {createOpen && acceptedCount > 0 && (
        <CreateSkillModal
          repoId={repoId}
          repoName={repoName}
          accepted={acceptedList}
          onClose={() => setCreateOpen(false)}
          t={t}
        />
      )}

      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <span className="mono">{repoName}</span>
            </h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <div style={s.headerActions}>
            {acceptedCount > 0 && (
              <Button kind="primary" size="sm" icon="Sparkles" onClick={() => setCreateOpen(true)}>
                {t("card.acceptAsSkill")}
              </Button>
            )}
            <Button
              kind="secondary"
              size="sm"
              icon="RefreshCw"
              loading={extract.isPending}
              onClick={runExtract}
            >
              {extract.isPending ? t("page.scanning") : t("page.rescan")}
            </Button>
          </div>
        </div>

        {extract.isError && (
          <div style={s.banner}>
            <Icon.AlertOctagon size={14} />
            {t("page.extractionFailed")}
            {extract.error instanceof ApiError ? `: ${extract.error.message}` : ""}
          </div>
        )}

        {!isLoading && !isError && list.length > 0 && (
          <div style={s.statsRow}>
            <span>{t("page.candidateCount", { count: list.length })}</span>
            {acceptedCount > 0 && (
              <Badge color="var(--ok)" bg="color-mix(in srgb, var(--ok) 12%, transparent)">
                {acceptedCount} {t("card.accepted").toLowerCase()}
              </Badge>
            )}
          </div>
        )}

        {isLoading ? (
          <div style={s.list}>
            <Skeleton height={140} />
            <Skeleton height={140} />
            <Skeleton height={140} />
          </div>
        ) : isError ? (
          <ErrorState
            body={error instanceof ApiError ? error.message : t("page.loadError")}
            onRetry={() => refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon="Scale"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={runExtract}
            ctaLoading={extract.isPending}
          />
        ) : (
          <div style={s.list}>
            {list.map((c) => (
              <ConventionCard
                key={c.id}
                c={c}
                repoFullName={repoFullName}
                defaultBranch={defaultBranch}
                pending={pendingId === c.id}
                onAccept={() => setAccepted(c.id, true)}
                onReject={() => setAccepted(c.id, false)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const s = {
  page: { padding: "24px 32px 44px", maxWidth: 860, margin: "0 auto" } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  } satisfies CSSProperties,
  headerText: { flex: 1 } satisfies CSSProperties,
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 } satisfies CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  subtitle: { fontSize: 14, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 } satisfies CSSProperties,
  statsRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 16,
  } satisfies CSSProperties,
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 13,
    color: "var(--crit)",
    background: "var(--crit-bg)",
    border: "1px solid color-mix(in srgb, var(--crit) 25%, transparent)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  card: (accepted: boolean): CSSProperties => ({
    borderColor: accepted ? "color-mix(in srgb, var(--ok) 35%, var(--border))" : undefined,
  }),
  rule: { fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45, marginBottom: 12 } satisfies CSSProperties,
  evidenceBlock: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 } satisfies CSSProperties,
  snippet: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: "var(--font-mono)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,
  confidenceRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 } satisfies CSSProperties,
  confidenceLabel: { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", width: 80, flexShrink: 0 } satisfies CSSProperties,
  confidenceBar: { flex: 1 } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  acceptBtn: {
    color: "var(--ok)",
    borderColor: "color-mix(in srgb, var(--ok) 40%, var(--border-strong))",
    background: "color-mix(in srgb, var(--ok) 10%, var(--bg-elevated))",
  } satisfies CSSProperties,
  modalBody: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
  preview: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--border-strong)",
    background: "var(--bg-surface)",
    fontSize: 12,
    lineHeight: 1.55,
    fontFamily: "var(--font-mono)",
    color: "var(--text-secondary)",
    maxHeight: 280,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,
} as const;
