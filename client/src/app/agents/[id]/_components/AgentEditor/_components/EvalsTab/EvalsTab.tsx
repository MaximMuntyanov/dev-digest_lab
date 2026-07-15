/* EvalsTab — the agent's regression harness (L06).
   Latest metrics, the eval-case list (each case's last result), a "Run all
   evals" button, and the run history with a side-by-side compare (old prompt vs
   new). Scoring is done server-side in code — no LLM. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, Modal } from "@devdigest/ui";
import type { Agent, EvalBatchRecord } from "@devdigest/shared";
import {
  useAgentEvalCases,
  useAgentEvalRuns,
  useRunEvalBatch,
  useDeleteEvalCase,
} from "../../../../../../../lib/hooks/eval";
import { useToast } from "../../../../../../../lib/toast";
import { s, cmpDelta } from "./styles";

const pct = (v: number | null | undefined): string =>
  v == null ? "—" : `${Math.round(v * 100)}%`;

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.metricCard}>
      <span style={s.metricLabel}>{label}</span>
      <span style={value === "—" ? s.metricValueMuted : s.metricValue}>{value}</span>
    </div>
  );
}

export function EvalsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("eval");
  const toast = useToast();

  const { data: cases, isLoading: casesLoading } = useAgentEvalCases(agent.id);
  const { data: runs } = useAgentEvalRuns(agent.id);
  const run = useRunEvalBatch(agent.id);
  const del = useDeleteEvalCase(agent.id);

  const [selected, setSelected] = React.useState<string[]>([]);
  const [compareOpen, setCompareOpen] = React.useState(false);

  const latest = runs?.[0] ?? null;
  const passing = (cases ?? []).filter((c) => c.last_result?.pass).length;
  const total = cases?.length ?? 0;

  const runAll = () =>
    run.mutate(undefined, {
      onSuccess: (b) =>
        toast.success(
          t("evalsTab.ranToast", {
            passed: b.passed,
            total: b.cases_total,
          }),
        ),
      onError: () => toast.error(t("evalsTab.runError")),
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2),
    );

  const comparePair = React.useMemo<[EvalBatchRecord, EvalBatchRecord] | null>(() => {
    if (selected.length !== 2 || !runs) return null;
    const picked = runs.filter((r) => selected.includes(r.id));
    if (picked.length !== 2) return null;
    const [a, b] = [...picked].sort(
      (x, y) => new Date(x.ran_at).getTime() - new Date(y.ran_at).getTime(),
    );
    return [a!, b!];
  }, [selected, runs]);

  return (
    <div style={s.wrap}>
      {/* metrics from the latest run */}
      <div style={s.header}>
        <h2 style={s.h2}>{t("evalsTab.metricsTitle")}</h2>
        <span style={s.caseMeta}>{t("evalsTab.metricsSubtitle")}</span>
      </div>
      <div style={s.metricsRow}>
        <MetricCard label={t("dashboard.metrics.recall")} value={pct(latest?.recall)} />
        <MetricCard label={t("dashboard.metrics.precision")} value={pct(latest?.precision)} />
        <MetricCard
          label={t("dashboard.metrics.citationAccuracy")}
          value={pct(latest?.citation_accuracy)}
        />
        <MetricCard
          label={t("evalsTab.tracesPassed")}
          value={latest ? `${latest.passed}/${latest.cases_total}` : "—"}
        />
      </div>

      {/* eval cases */}
      <div style={s.header}>
        <h2 style={s.h2}>{t("evalsTab.casesHeading")}</h2>
        <Badge color="var(--accent)">
          {t("evalsTab.passingCount", { passing, total })}
        </Badge>
        <span style={s.spacer} />
        <Button
          kind="primary"
          size="sm"
          icon="Play"
          onClick={runAll}
          disabled={run.isPending || total === 0}
        >
          {run.isPending ? t("evalsTab.running") : t("evalsTab.runAll")}
        </Button>
      </div>

      {casesLoading ? (
        <div style={s.empty}>{t("evalsTab.loadingCases")}</div>
      ) : total === 0 ? (
        <div style={s.empty}>{t("evalsTab.emptyCases")}</div>
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
                <Badge
                  color={c.expectation_kind === "must_find" ? "var(--ok)" : "#b06be0"}
                >
                  {t(`evalsTab.kind.${c.expectation_kind}`)}
                </Badge>
                <span style={s.caseMeta}>
                  {c.expected_output
                    ? `${c.expected_output.file}:${c.expected_output.start_line}`
                    : ""}
                </span>
                <span style={s.spacer} />
                <span style={s.caseMeta}>
                  {!r
                    ? t("evalsTab.neverRun")
                    : r.pass
                      ? t("evalsTab.passed")
                      : t("evalsTab.failed")}
                </span>
                <Button
                  kind="ghost"
                  size="sm"
                  icon="Trash"
                  onClick={() => del.mutate(c.id)}
                  disabled={del.isPending}
                >
                  {t("evalsTab.delete")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* run history + compare */}
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
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={() => toggleSelect(r.id)}
              />
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
    </div>
  );
}

function CompareModal({
  a,
  b,
  onClose,
}: {
  a: EvalBatchRecord;
  b: EvalBatchRecord;
  onClose: () => void;
}) {
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
          <Badge color="var(--text-muted)">
            {t("compare.old", { v: a.agent_version ?? "?" })}
          </Badge>
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
