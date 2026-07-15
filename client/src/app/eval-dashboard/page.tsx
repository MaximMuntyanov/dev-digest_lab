/* /eval-dashboard — the regression harness across all reviewer agents (L06).
   Each agent's latest recall/precision/citation + a table of the most recent
   eval runs across the workspace. Pick an agent to open its Evals tab. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../components/app-shell";
import { Badge, Button, Icon, Skeleton } from "@devdigest/ui";
import { useEvalDashboard } from "../../lib/hooks/eval";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";

const pct = (v: number | null | undefined): string =>
  v == null ? "—" : `${Math.round(v * 100)}%`;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 70 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.5, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{value}</span>
    </div>
  );
}

export default function EvalDashboardPage() {
  const t = useTranslations("eval");
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useEvalDashboard();
  const [running, setRunning] = React.useState(false);

  const agents = data?.agents ?? [];
  const recent = data?.recent_runs ?? [];
  const nameById = new Map(agents.map((a) => [a.agent_id, a.agent_name]));

  const crumb = [{ label: t("page.crumbSkillsLab") }, { label: t("page.crumbEvalDashboard") }];

  const runAll = async () => {
    const targets = agents.filter((a) => a.cases_total > 0);
    if (targets.length === 0) return;
    setRunning(true);
    try {
      for (const a of targets) {
        await api.post(`/agents/${a.agent_id}/eval-runs`);
      }
      await qc.invalidateQueries({ queryKey: ["eval", "dashboard"] });
      toast.success(t("dashboard.ranAllToast", { count: targets.length }));
    } catch {
      toast.error(t("evalsTab.runError"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell crumb={crumb}>
      <div style={{ padding: 28, maxWidth: 1040 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <Icon.Gauge size={22} style={{ color: "var(--accent)" }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1 }}>{t("dashboard.defaultTitle")}</h1>
          <Button kind="primary" icon="Play" onClick={runAll} disabled={running || agents.length === 0}>
            {running ? t("evalsTab.running") : t("dashboard.runAllAgents")}
          </Button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 22 }}>
          {t("dashboard.subtitle")}
        </div>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </div>
        ) : agents.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: "var(--text-secondary)" }}>
            {t("dashboard.emptyAgents")}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--text-muted)", margin: "8px 0" }}>
              {t("dashboard.agentsHeading")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {agents.map((a) => (
                <button
                  key={a.agent_id}
                  onClick={() => router.push(`/agents/${a.agent_id}?tab=evals`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 18px",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    background: "var(--bg-surface)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Icon.Cpu size={18} style={{ color: "var(--text-secondary)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{a.agent_name}</span>
                      {a.model && <Badge color="var(--text-muted)">{a.model}</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                      {a.latest
                        ? t("dashboard.lastRun", {
                            version: a.latest.agent_version ?? "?",
                            date: new Date(a.latest.ran_at).toLocaleDateString(),
                            passed: a.latest.passed,
                            total: a.latest.cases_total,
                          })
                        : t("dashboard.agentNoRuns", { count: a.cases_total })}
                    </div>
                  </div>
                  <Metric label={t("dashboard.metrics.recall")} value={pct(a.latest?.recall)} />
                  <Metric label={t("dashboard.metrics.precision")} value={pct(a.latest?.precision)} />
                  <Metric
                    label={t("dashboard.metrics.citationAccuracy")}
                    value={pct(a.latest?.citation_accuracy)}
                  />
                  <Icon.ChevronRight size={18} style={{ color: "var(--text-muted)" }} />
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, letterSpacing: 0.6, color: "var(--text-muted)", margin: "8px 0" }}>
              {t("dashboard.recentRuns")}
            </div>
            {recent.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                {t("dashboard.noRuns")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {recent.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1.2fr 50px 1fr 1fr 1fr 70px",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--bg-surface)",
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{nameById.get(r.owner_id) ?? "agent"}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Date(r.ran_at).toLocaleString()}
                    </span>
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                      v{r.agent_version ?? "?"}
                    </span>
                    <span>{pct(r.recall)}</span>
                    <span>{pct(r.precision)}</span>
                    <span>{pct(r.citation_accuracy)}</span>
                    <span style={{ fontWeight: 600 }}>
                      {r.passed}/{r.cases_total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
