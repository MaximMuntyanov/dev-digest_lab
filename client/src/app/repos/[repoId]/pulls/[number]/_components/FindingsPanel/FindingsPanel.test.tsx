import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

function makeFinding(overrides: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "WARNING",
    category: "bug",
    title: "Default title",
    file: "src/app.ts",
    start_line: 1,
    end_line: 1,
    rationale: "Rationale.",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

const FINDINGS: FindingRecord[] = [
  makeFinding({ id: "f1", severity: "CRITICAL", category: "security", title: "Hardcoded secret", file: "src/config.ts", start_line: 11, end_line: 11, confidence: 0.95 }),
];

const MIXED_FINDINGS: FindingRecord[] = [
  makeFinding({ id: "f1", severity: "CRITICAL", title: "Critical bug" }),
  makeFinding({ id: "f2", severity: "CRITICAL", title: "Another critical" }),
  makeFinding({ id: "f3", severity: "WARNING", title: "A warning" }),
  makeFinding({ id: "f4", severity: "SUGGESTION", title: "Style nit" }),
  makeFinding({ id: "f5", severity: "SUGGESTION", title: "Another nit" }),
  makeFinding({ id: "f6", severity: "SUGGESTION", title: "Third nit" }),
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel severity counters", () => {
  it("renders correct counts per severity", () => {
    renderWithIntl(<FindingsPanel findings={MIXED_FINDINGS} prId="pr1" />);
    const critBtn = screen.getByRole("button", { name: /filter by critical/i });
    const warnBtn = screen.getByRole("button", { name: /filter by warning/i });
    const suggBtn = screen.getByRole("button", { name: /filter by suggestion/i });
    expect(critBtn).toHaveTextContent("2");
    expect(warnBtn).toHaveTextContent("1");
    expect(suggBtn).toHaveTextContent("3");
  });

  it("clicking a severity chip filters to only that severity", () => {
    renderWithIntl(<FindingsPanel findings={MIXED_FINDINGS} prId="pr1" />);
    expect(screen.getAllByText(/bug|nit|warning|critical/i).length).toBeGreaterThan(3);

    fireEvent.click(screen.getByRole("button", { name: /filter by warning/i }));
    expect(screen.getByText("A warning")).toBeInTheDocument();
    expect(screen.queryByText("Critical bug")).not.toBeInTheDocument();
    expect(screen.queryByText("Style nit")).not.toBeInTheDocument();
  });

  it("clicking the same chip again resets to show all", () => {
    renderWithIntl(<FindingsPanel findings={MIXED_FINDINGS} prId="pr1" />);

    const warnBtn = screen.getByRole("button", { name: /filter by warning/i });
    fireEvent.click(warnBtn);
    expect(screen.queryByText("Critical bug")).not.toBeInTheDocument();

    fireEvent.click(warnBtn);
    expect(screen.getByText("Critical bug")).toBeInTheDocument();
    expect(screen.getByText("A warning")).toBeInTheDocument();
    expect(screen.getByText("Style nit")).toBeInTheDocument();
  });
});
