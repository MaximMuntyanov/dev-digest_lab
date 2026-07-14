import type {
  EvalCasePerResult,
  EvalExpectationKind,
  EvalExpectedFinding,
} from '@devdigest/shared';

/**
 * Deterministic eval scorer — L06.
 *
 * PURE CODE, NO LLM. A finding counts against a case when it hits the SAME FILE
 * and its [start_line,end_line] OVERLAPS the case's expected range. From those
 * matches we derive:
 *   - recall            = must_find cases matched / must_find cases
 *   - precision         = TP / (TP + FP), where TP = must_find matched and
 *                         FP = must_not_flag cases the agent wrongly flagged
 *   - citation_accuracy = findings surviving grounding / all emitted findings
 *
 * The agent review itself uses the model (as any review does); this module never
 * imports a provider — scoring is a function of the engine's output only.
 */

/** A finding the agent emitted, reduced to what scoring needs. */
export interface EmittedFinding {
  file: string;
  start_line: number;
  end_line: number;
  title?: string | null;
  severity?: string | null;
  category?: string | null;
}

/** One case's inputs to the scorer: expectation + what the agent produced. */
export interface ScoreCaseInput {
  case_id: string;
  case_name: string;
  expectation_kind: EvalExpectationKind;
  expected: EvalExpectedFinding | null;
  /** Findings that survived the grounding gate for this case's diff. */
  kept: EmittedFinding[];
  /** How many findings the grounding gate dropped for this case's diff. */
  dropped_count: number;
  note?: string | null;
}

export interface BatchMetrics {
  recall: number;
  precision: number;
  citation_accuracy: number;
  passed: number;
  cases_total: number;
}

/** Two inclusive line ranges overlap. */
function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 <= b2 && b1 <= a2;
}

/** A finding matches an expectation when file is equal and line ranges overlap. */
export function matchesExpected(f: EmittedFinding, exp: EvalExpectedFinding): boolean {
  return f.file === exp.file && rangesOverlap(f.start_line, f.end_line, exp.start_line, exp.end_line);
}

/** Score a single case into a per-case result. */
export function scoreCase(input: ScoreCaseInput): EvalCasePerResult {
  const exp = input.expected;
  const matched = exp ? input.kept.filter((f) => matchesExpected(f, exp)) : [];
  const found = matched.length > 0;
  // must_find passes when the expected location was flagged;
  // must_not_flag passes when it was NOT flagged.
  const pass = input.expectation_kind === 'must_find' ? found : !found;
  return {
    case_id: input.case_id,
    case_name: input.case_name,
    expectation_kind: input.expectation_kind,
    pass,
    expected: exp,
    matched: matched.map((f) => ({
      file: f.file,
      start_line: f.start_line,
      end_line: f.end_line,
      title: f.title ?? null,
      severity: f.severity ?? null,
      category: f.category ?? null,
    })),
    grounded_dropped: input.dropped_count,
    note: input.note ?? null,
  };
}

/** Score a whole batch: per-case results + aggregate metrics. Fully deterministic. */
export function scoreBatch(inputs: ScoreCaseInput[]): {
  results: EvalCasePerResult[];
  metrics: BatchMetrics;
} {
  const results = inputs.map(scoreCase);

  const mustFind = results.filter((r) => r.expectation_kind === 'must_find');
  // No must_find cases → nothing to miss → recall is 1.0 (documented edge case).
  const recall = mustFind.length ? mustFind.filter((r) => r.pass).length / mustFind.length : 1;

  const tp = mustFind.filter((r) => r.matched.length > 0).length;
  const fp = results.filter(
    (r) => r.expectation_kind === 'must_not_flag' && r.matched.length > 0,
  ).length;
  // No positives at all → precision is 1.0 (nothing wrong was emitted).
  const precision = tp + fp ? tp / (tp + fp) : 1;

  const totalKept = inputs.reduce((s, c) => s + c.kept.length, 0);
  const totalDropped = inputs.reduce((s, c) => s + c.dropped_count, 0);
  const emitted = totalKept + totalDropped;
  const citation_accuracy = emitted ? totalKept / emitted : 1;

  const passed = results.filter((r) => r.pass).length;

  return {
    results,
    metrics: {
      recall: round(recall),
      precision: round(precision),
      citation_accuracy: round(citation_accuracy),
      passed,
      cases_total: results.length,
    },
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
