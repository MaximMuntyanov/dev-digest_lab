"use client";

import React from "react";
import { Icon } from "@devdigest/ui";
import { Button, Badge, Card } from "@devdigest/ui";
import { usePrIntent, useExtractIntent } from "@/lib/hooks/intent";

interface IntentCardProps {
  prId: string | null;
}

export function IntentCard({ prId }: IntentCardProps) {
  const { data: intent, isLoading, isError } = usePrIntent(prId);
  const extract = useExtractIntent(prId);
  const [showMeta, setShowMeta] = React.useState(false);

  if (!prId) return null;

  if (isLoading) {
    return (
      <Card style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon.Brain size={16} style={{ color: "var(--accent-text)" }} />
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading intent…</span>
        </div>
      </Card>
    );
  }

  if (isError || !intent) {
    return (
      <Card style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon.Brain size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 14, color: "var(--text-muted)", flex: 1 }}>
            Intent not computed yet
          </span>
          <Button
            kind="secondary"
            size="sm"
            icon="Sparkles"
            onClick={() => extract.mutate()}
            loading={extract.isPending}
          >
            Classify Intent
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Icon.Brain size={16} style={{ color: "var(--accent-text)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
          Intent Layer
        </span>
        <Button
          kind="ghost"
          size="sm"
          icon="RefreshCw"
          onClick={() => extract.mutate()}
          loading={extract.isPending}
        >
          Re-classify
        </Button>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-primary)", margin: "0 0 12px", lineHeight: 1.5 }}>
        {intent.intent}
      </p>

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--code-add-text)", marginBottom: 6 }}>
            In Scope
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {intent.in_scope.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
            Out of Scope
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {intent.out_of_scope.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {extract.data?._meta && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          <button
            onClick={() => setShowMeta((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--text-muted)",
              padding: 0,
            }}
          >
            <Icon.ChevronRight
              size={10}
              style={{ transform: showMeta ? "rotate(90deg)" : "none", transition: "transform .12s" }}
            />
            Model info
          </button>
          {showMeta && (
            <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
              <Badge mono>{extract.data._meta.model}</Badge>
              <Badge mono>{extract.data._meta.tokens_in} in</Badge>
              <Badge mono>{extract.data._meta.tokens_out} out</Badge>
              {extract.data._meta.cost_usd != null && (
                <Badge mono>${extract.data._meta.cost_usd.toFixed(4)}</Badge>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
