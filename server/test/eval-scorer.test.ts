import { describe, it, expect } from 'vitest';
import { scoreBatch, scoreCase, matchesExpected, type ScoreCaseInput } from '../src/modules/eval/scorer.js';

/**
 * Scorer unit tests (L06) — PURE, NO DB, NO LLM.
 *
 * This file is the proof that scoring is deterministic code: it imports only the
 * scorer, never a provider or the app. recall/precision/citation_accuracy are a
 * function of (expected file+range) vs (emitted findings) alone.
 */
describe('eval scorer — deterministic, no LLM', () => {
  it('matchesExpected: same file + overlapping range', () => {
    const exp = { file: 'src/a.ts', start_line: 10, end_line: 12 };
    expect(matchesExpected({ file: 'src/a.ts', start_line: 11, end_line: 11 }, exp)).toBe(true);
    expect(matchesExpected({ file: 'src/a.ts', start_line: 12, end_line: 20 }, exp)).toBe(true);
    expect(matchesExpected({ file: 'src/a.ts', start_line: 13, end_line: 20 }, exp)).toBe(false);
    expect(matchesExpected({ file: 'src/b.ts', start_line: 11, end_line: 11 }, exp)).toBe(false);
  });

  it('scoreCase: must_find passes only when the expected location is flagged', () => {
    const base: ScoreCaseInput = {
      case_id: 'c1',
      case_name: 'secret',
      expectation_kind: 'must_find',
      expected: { file: 'src/config.ts', start_line: 12, end_line: 12 },
      kept: [],
      dropped_count: 0,
    };
    expect(scoreCase(base).pass).toBe(false);
    expect(
      scoreCase({
        ...base,
        kept: [{ file: 'src/config.ts', start_line: 12, end_line: 12 }],
      }).pass,
    ).toBe(true);
  });

  it('scoreCase: must_not_flag passes only when the location is NOT flagged', () => {
    const base: ScoreCaseInput = {
      case_id: 'c2',
      case_name: 'clean',
      expectation_kind: 'must_not_flag',
      expected: { file: 'src/config.ts', start_line: 12, end_line: 12 },
      kept: [],
      dropped_count: 0,
    };
    expect(scoreCase(base).pass).toBe(true);
    expect(
      scoreCase({
        ...base,
        kept: [{ file: 'src/config.ts', start_line: 12, end_line: 12 }],
      }).pass,
    ).toBe(false);
  });

  it('scoreBatch: recall/precision/citation are computed purely from findings', () => {
    const inputs: ScoreCaseInput[] = [
      // must_find, found → TP, recall hit
      {
        case_id: 'A',
        case_name: 'found',
        expectation_kind: 'must_find',
        expected: { file: 'a.ts', start_line: 1, end_line: 1 },
        kept: [{ file: 'a.ts', start_line: 1, end_line: 1 }],
        dropped_count: 0,
      },
      // must_find, missed → recall miss (agent emitted nothing that matched)
      {
        case_id: 'B',
        case_name: 'missed',
        expectation_kind: 'must_find',
        expected: { file: 'b.ts', start_line: 5, end_line: 5 },
        kept: [],
        dropped_count: 1,
      },
      // must_not_flag, wrongly flagged → FP, precision drop
      {
        case_id: 'C',
        case_name: 'noise',
        expectation_kind: 'must_not_flag',
        expected: { file: 'c.ts', start_line: 3, end_line: 3 },
        kept: [{ file: 'c.ts', start_line: 3, end_line: 3 }],
        dropped_count: 0,
      },
    ];
    const { results, metrics } = scoreBatch(inputs);
    expect(results).toHaveLength(3);
    // 2 must_find, 1 matched → recall 0.5
    expect(metrics.recall).toBe(0.5);
    // TP=1 (A), FP=1 (C) → precision 0.5
    expect(metrics.precision).toBe(0.5);
    // kept=2 (A,C), dropped=1 (B) → citation 2/3
    expect(metrics.citation_accuracy).toBeCloseTo(0.6667, 3);
    expect(metrics.passed).toBe(1); // only A passes
    expect(metrics.cases_total).toBe(3);
  });

  it('scoreBatch: empty / no-positive sets are defined (1.0), never NaN', () => {
    expect(scoreBatch([]).metrics).toMatchObject({ recall: 1, precision: 1, citation_accuracy: 1 });
    const onlyMustNotFlag: ScoreCaseInput[] = [
      {
        case_id: 'X',
        case_name: 'clean',
        expectation_kind: 'must_not_flag',
        expected: { file: 'x.ts', start_line: 1, end_line: 1 },
        kept: [],
        dropped_count: 0,
      },
    ];
    const m = scoreBatch(onlyMustNotFlag).metrics;
    expect(m.recall).toBe(1);
    expect(m.precision).toBe(1);
    expect(m.passed).toBe(1);
  });
});
