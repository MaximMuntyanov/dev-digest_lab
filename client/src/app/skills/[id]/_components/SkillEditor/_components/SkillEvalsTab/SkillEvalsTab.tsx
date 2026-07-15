/* SkillEvalsTab — the skill's regression harness. Same shape as the agent
   EvalsTab: latest metrics, the eval-case list, "Run all evals" (injects the
   skill body over a base reviewer, scores in code), run history + compare
   (old skill body vs new). Reuses the "eval" i18n namespace. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, Icon, Modal, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { EvalBatchRecord, Skill } from "@devdigest/shared";
import {
  useSkillEvalCases,
  useSkillEvalRuns,
  useRunSkillEvalBatch,
  useDeleteSkillEvalCase,
  useCreateSkillEvalCase,
} from "../../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../../lib/toast";
import { s, cmpDelta } from "../../styles";

const pct = (v: number | null | undefined): string => (v == null ? "—" : `${Math.round(v * 100)}%`);

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.metricCard}>
      <span style={s.metricLabel}>{label}</span>
      <span style={value === "—" ? s.metricValueMuted : s.metricValue}>{value}</span>
    </div>
  );
}

export function SkillEvalsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("eval");
  const ts = useTranslations("skills");
  const toast = useToast();

  const { data: cases, isLoading: casesLoading } = useSkillEvalCases(skill.id);
  const { data: runs } = useSkillEvalRuns(skill.id);
  const run = useRunSkillEvalBatch(skill.id);
  const del = useDeleteSkillEvalCase(skill.id);

  const [selected, setSelected] = React.useState<string[]>([]);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  const latest = runs?.[0] ?? null;
  const passing = (cases ?? []).filter((c) => c.last_result?.pass).length;
  const total = cases?.length ?? 0;

  const runAll = () =>
    run.mutate(undefined, {
      onSuccess: (b) => toast.success(t("evalsTab.ranToast", { passed: b.passed, total: b.cases_total })),
      onError: () => toast.error(t("evalsTab.runError")),
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2)));

  const comparePair = React.useMemo<[EvalBatchRecord, EvalBatchRecord] | null>(() => {
    if (selected.length !== 2 || !runs) return null;
    const picked = runs.filter((r) => selected.includes(r.id));
    if (picked.length !== 2) return null;
    const [a, b] = [...picked].sort((x, y) => new Date(x.ran_at).getTime() - new Date(y.ran_at).getTime());
    return [a!, b!];
  }, [selected, runs]);

  return (
    <div style={s.ewrap}>
      <div style={s.metricsRow}>
        <MetricCard label={t("dashboard.metrics.recall")} value={pct(latest?.recall)} />
        <MetricCard label={t("dashboard.metrics.precision")} value={pct(latest?.precision)} />
        <MetricCard label={t("dashboard.metrics.citationAccuracy")} value={pct(latest?.citation_accuracy)} />
        <MetricCard
          label={t("evalsTab.tracesPassed")}
          value={latest ? `${latest.passed}/${latest.cases_total}` : "—"}
        />
      </div>

      <div style={s.header}>
        <h2 style={s.h2}>{t("evalsTab.casesHeading")}</h2>
        <Badge color="var(--accent)">{t("evalsTab.passingCount", { passing, total })}</Badge>
        <span style={s.spacer} />
        <Button kind="secondary" size="sm" icon="Plus" onClick={() => setAddOpen(true)}>
          {ts("evals.addCase")}
        </Button>
        <Button kind="primary" size="sm" icon="Play" onClick={runAll} disabled={run.isPending || total === 0}>
          {run.isPending ? t("evalsTab.running") : t("evalsTab.runAll")}
        </Button>
      </div>

      {casesLoading ? (
        <div style={s.empty}>{t("evalsTab.loadingCases")}</div>
      ) : total === 0 ? (
        <div style={s.empty}>{ts("evals.emptyHint")}</div>
      ) : (
        <div style={s.list}>
          {(cases ?? []).map((c) => {
            const r = c.last_result;
            const statusIcon = !r ? (
              <Icon.Dot size={16} style={{ color: "var(--text-muted)" }} />
            ) : r.pass ? (
              <Icon.CheckCircle size={16} style={{ color: "var(--ok)" }} />
            ) : (
              <Icon.XCircle size={16} style={{ color: "var(--crit)" }} />
            );
            return (
              <div key={c.id} style={s.row}>
                {statusIcon}
                <span style={s.caseName}>{c.name}</span>
                <Badge color={c.expectation_kind === "must_find" ? "var(--ok)" : "#b06be0"}>
                  {t(`evalsTab.kind.${c.expectation_kind}`)}
                </Badge>
                <span style={s.caseMeta}>
                  {c.expected_output ? `${c.expected_output.file}:${c.expected_output.start_line}` : ""}
                </span>
                <span style={s.spacer} />
                <span style={s.caseMeta}>
                  {!r ? t("evalsTab.neverRun") : r.pass ? t("evalsTab.passed") : t("evalsTab.failed")}
                </span>
                <Button kind="ghost" size="sm" icon="Trash" onClick={() => del.mutate(c.id)} disabled={del.isPending}>
                  {t("evalsTab.delete")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div style={s.header}>
        <h2 style={s.h2}>{t("evalsTab.historyHeading")}</h2>
        <span style={s.spacer} />
        <Button
          kind="secondary"
          size="sm"
          icon="TrendingUp"
          onClick={() => setCompareOpen(true)}
          disabled={selected.length !== 2}
        >
          {t("evalsTab.compare")}
        </Button>
      </div>

      {(runs?.length ?? 0) === 0 ? (
        <div style={s.empty}>{t("dashboard.noRuns")}</div>
      ) : (
        <div style={s.runsTable}>
          <div style={s.runHead}>
            <span />
            <span>{t("dashboard.table.ranAt")}</span>
            <span>v</span>
            <span>{t("dashboard.table.recall")}</span>
            <span>{t("dashboard.table.precision")}</span>
            <span>{t("dashboard.table.citation")}</span>
            <span>{t("dashboard.table.pass")}</span>
            <span>{t("dashboard.table.cost")}</span>
          </div>
          {(runs ?? []).map((r) => (
            <div key={r.id} style={s.runRow}>
              <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} />
              <span>{new Date(r.ran_at).toLocaleString()}</span>
              <span style={s.ver}>v{r.agent_version ?? "?"}</span>
              <span>{pct(r.recall)}</span>
              <span>{pct(r.precision)}</span>
              <span>{pct(r.citation_accuracy)}</span>
              <span>
                {r.passed}/{r.cases_total}
              </span>
              <span>{r.cost_usd == null ? "—" : `$${r.cost_usd.toFixed(3)}`}</span>
            </div>
          ))}
        </div>
      )}

      {compareOpen && comparePair && (
        <CompareModal a={comparePair[0]} b={comparePair[1]} onClose={() => setCompareOpen(false)} />
      )}
      {addOpen && <AddCaseModal skillId={skill.id} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function CompareModal({ a, b, onClose }: { a: EvalBatchRecord; b: EvalBatchRecord; onClose: () => void }) {
  const t = useTranslations("eval");
  const delta = (x: number | null, y: number | null) =>
    x == null || y == null ? null : Math.round((y - x) * 100);

  const rows: { label: string; av: number | null; bv: number | null }[] = [
    { label: t("dashboard.table.recall"), av: a.recall, bv: b.recall },
    { label: t("dashboard.table.precision"), av: a.precision, bv: b.precision },
    { label: t("dashboard.table.citation"), av: a.citation_accuracy, bv: b.citation_accuracy },
  ];

  return (
    <Modal
      title={t("compare.title", { av: a.agent_version ?? "?", bv: b.agent_version ?? "?" })}
      subtitle={t("compare.subtitle")}
      width={860}
      onClose={onClose}
    >
      <div style={s.compareGrid}>
        {rows.map((row) => {
          const d = delta(row.av, row.bv);
          return (
            <div key={row.label} style={s.cmpCard}>
              <span style={s.metricLabel}>{row.label}</span>
              <span style={s.metricValue}>
                {row.av == null ? "—" : `${Math.round(row.av * 100)}%`} →{" "}
                {row.bv == null ? "—" : `${Math.round(row.bv * 100)}%`}
              </span>
              <span style={cmpDelta(d != null && d > 0, d == null || d === 0)}>
                {d == null ? "" : d > 0 ? `▲ ${d}pt` : d < 0 ? `▼ ${Math.abs(d)}pt` : "no change"}
              </span>
            </div>
          );
        })}
      </div>
      <div style={s.promptDiff}>
        <div style={s.promptCol}>
          <Badge color="var(--text-muted)">{t("compare.old", { v: a.agent_version ?? "?" })}</Badge>
          <pre style={s.promptPre}>{a.system_prompt ?? ""}</pre>
        </div>
        <div style={s.promptCol}>
          <Badge color="var(--accent)">{t("compare.new", { v: b.agent_version ?? "?" })}</Badge>
          <pre style={s.promptPre}>{b.system_prompt ?? ""}</pre>
        </div>
      </div>
    </Modal>
  );
}

function AddCaseModal({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const ts = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkillEvalCase(skillId);

  const [name, setName] = React.useState("");
  const [diff, setDiff] = React.useState("");
  const [kind, setKind] = React.useState<"must_find" | "must_not_flag">("must_find");
  const [file, setFile] = React.useState("");
  const [startLine, setStartLine] = React.useState("1");
  const [endLine, setEndLine] = React.useState("1");

  const submit = () =>
    create.mutate(
      {
        name,
        input_diff: diff,
        expectation_kind: kind,
        expected: file.trim()
          ? { file: file.trim(), start_line: Number(startLine) || 1, end_line: Number(endLine) || 1 }
          : null,
      },
      {
        onSuccess: () => {
          toast.success(ts("evals.createdToast"));
          onClose();
        },
        onError: () => toast.error(ts("evals.createError")),
      },
    );

  const valid = name.trim() && diff.trim();

  return (
    <Modal title={ts("evals.addCaseTitle")} width={680} onClose={onClose}>
      <div style={s.addForm}>
        <FormField label={ts("evals.caseName")} required>
          <TextInput value={name} onChange={setName} />
        </FormField>
        <FormField label={ts("evals.caseKind")}>
          <SelectInput
            value={kind}
            onChange={(v) => setKind(v as "must_find" | "must_not_flag")}
            options={[
              { value: "must_find", label: "must_find" },
              { value: "must_not_flag", label: "must_not_flag" },
            ]}
          />
        </FormField>
        <FormField label={ts("evals.caseDiff")} required>
          <Textarea value={diff} onChange={setDiff} rows={8} mono placeholder={ts("evals.caseDiffPlaceholder")} />
        </FormField>
        <div style={s.addRow}>
          <FormField label={ts("evals.expectedFile")}>
            <TextInput value={file} onChange={setFile} />
          </FormField>
          <FormField label={ts("evals.expectedStart")}>
            <TextInput value={startLine} onChange={setStartLine} />
          </FormField>
          <FormField label={ts("evals.expectedEnd")}>
            <TextInput value={endLine} onChange={setEndLine} />
          </FormField>
        </div>
        <div style={s.modalActions}>
          <Button kind="secondary" onClick={onClose}>
            {ts("evals.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? ts("evals.creating") : ts("evals.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
