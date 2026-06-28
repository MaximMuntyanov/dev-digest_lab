"use client";

import React from "react";
import { Skeleton } from "@devdigest/ui";
import { SmartDiffViewer } from "@/components/smart-diff";
import { useSmartDiff } from "@/lib/hooks/smart-diff";
import type { PrFile } from "@devdigest/shared";

interface SmartDiffTabProps {
  prId: string | null;
  prFiles: PrFile[];
}

export function SmartDiffTab({ prId, prFiles }: SmartDiffTabProps) {
  const { data: smartDiff, isLoading, isError } = useSmartDiff(prId);

  if (isLoading) {
    return (
      <section>
        <Skeleton height={28} width={300} />
        <div style={{ marginTop: 16 }}>
          <Skeleton height={200} />
        </div>
      </section>
    );
  }

  if (isError || !smartDiff) {
    return (
      <section style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
        Failed to load Smart Diff data.
      </section>
    );
  }

  return (
    <section>
      <SmartDiffViewer smartDiff={smartDiff} prFiles={prFiles} />
    </section>
  );
}
