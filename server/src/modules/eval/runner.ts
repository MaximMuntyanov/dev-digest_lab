import type { Container } from '../../platform/container.js';
import type { Provider } from '@devdigest/shared';
import { reviewPullRequest } from '@devdigest/reviewer-core';
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
import type { EvalExpectedFinding } from '@devdigest/shared';
import { scoreBatch, type ScoreCaseInput, type BatchMetrics } from './scorer.js';
import type { EvalCasePerResult } from '@devdigest/shared';

/** The agent snapshot an eval batch runs against (and records for comparability). */
export interface EvalAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  systemPrompt: string;
  strategy: 'single-pass' | 'map-reduce' | 'auto';
  version: number;
  /**
   * Resolved skill bodies to inject into the review (skill evals: the artifact under
   * test is a skill body run on top of a base reviewer prompt). Empty/undefined for
   * agent evals — the agent's own system prompt is the artifact.
   */
  skills?: string[];
}

/** A case as the runner needs it (already loaded from `eval_cases`). */
export interface EvalRunnerCase {
  id: string;
  name: string;
  expectationKind: 'must_find' | 'must_not_flag';
  inputDiff: string | null;
  expected: EvalExpectedFinding | null;
}

export interface EvalBatchResult {
  results: EvalCasePerResult[];
  metrics: BatchMetrics;
  costUsd: number | null;
  durationMs: number;
}

/**
 * Run an agent over ALL its eval cases and score deterministically.
 *
 * Each case carries its own diff fragment; we run the SAME engine used for real
 * reviews (`reviewPullRequest`) once per case, then hand the kept/dropped
 * findings to the pure scorer. No results are persisted here — the caller writes
 * the batch + per-case rows. Unparseable / empty diffs are skipped honestly with
 * a note instead of throwing (spec AC10).
 */
export async function runEvalBatch(
  container: Container,
  agent: EvalAgent,
  cases: EvalRunnerCase[],
): Promise<EvalBatchResult> {
  const startedAt = Date.now();

  if (cases.length === 0) {
    return { results: [], metrics: emptyMetrics(), costUsd: null, durationMs: 0 };
  }

  const llm = await container.llm(agent.provider as Provider);
  const inputs: ScoreCaseInput[] = [];
  let costUsd = 0;
  let sawCost = false;

  for (const c of cases) {
    const raw = (c.inputDiff ?? '').trim();
    if (!raw) {
      inputs.push({
        case_id: c.id,
        case_name: c.name,
        expectation_kind: c.expectationKind,
        expected: c.expected,
        kept: [],
        dropped_count: 0,
        note: 'empty diff — case skipped',
      });
      continue;
    }

    let diff;
    try {
      diff = parseUnifiedDiff(raw);
    } catch {
      inputs.push({
        case_id: c.id,
        case_name: c.name,
        expectation_kind: c.expectationKind,
        expected: c.expected,
        kept: [],
        dropped_count: 0,
        note: 'diff could not be parsed — case skipped',
      });
      continue;
    }

    const outcome = await reviewPullRequest({
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      diff,
      llm,
      strategy: agent.strategy ?? 'single-pass',
      ...(agent.skills && agent.skills.length ? { skills: agent.skills } : {}),
    });

    if (typeof outcome.costUsd === 'number') {
      costUsd += outcome.costUsd;
      sawCost = true;
    }

    inputs.push({
      case_id: c.id,
      case_name: c.name,
      expectation_kind: c.expectationKind,
      expected: c.expected,
      kept: outcome.review.findings.map((f) => ({
        file: f.file,
        start_line: f.start_line,
        end_line: f.end_line,
        title: f.title,
        severity: f.severity,
        category: f.category,
      })),
      dropped_count: outcome.dropped.length,
    });
  }

  const { results, metrics } = scoreBatch(inputs);
  return {
    results,
    metrics,
    costUsd: sawCost ? costUsd : null,
    durationMs: Date.now() - startedAt,
  };
}

function emptyMetrics(): BatchMetrics {
  return { recall: 1, precision: 1, citation_accuracy: 1, passed: 0, cases_total: 0 };
}
