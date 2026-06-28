import type { SmartDiff, SmartDiffFile, SmartDiffGroup, SmartDiffRole } from '@devdigest/shared';
import { classifyFile } from './classifier.js';
import { SPLIT_THRESHOLD_LINES, SPLIT_CHUNK_SIZE } from './constants.js';

interface PrFileInput {
  path: string;
  additions: number;
  deletions: number;
}

interface FindingInput {
  file: string;
  start_line: number;
  end_line: number;
}

/**
 * Build a SmartDiff response from raw PR files and (optional) review findings.
 * Purely deterministic — zero LLM calls.
 */
export function buildSmartDiff(
  files: PrFileInput[],
  findings: FindingInput[],
): SmartDiff {
  const findingsByFile = new Map<string, number[]>();
  for (const f of findings) {
    const lines = findingsByFile.get(f.file) ?? [];
    for (let l = f.start_line; l <= f.end_line; l++) lines.push(l);
    findingsByFile.set(f.file, lines);
  }

  const buckets = new Map<SmartDiffRole, SmartDiffFile[]>();
  const roleOrder: SmartDiffRole[] = ['core', 'wiring', 'boilerplate'];
  for (const r of roleOrder) buckets.set(r, []);

  for (const file of files) {
    const role = classifyFile(file.path);
    const findingLines = [...new Set(findingsByFile.get(file.path) ?? [])].sort(
      (a, b) => a - b,
    );
    buckets.get(role)!.push({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      finding_lines: findingLines,
    });
  }

  // Sort files within each group: files with findings first, then by change size desc
  for (const list of buckets.values()) {
    list.sort((a, b) => {
      const af = a.finding_lines.length > 0 ? 1 : 0;
      const bf = b.finding_lines.length > 0 ? 1 : 0;
      if (af !== bf) return bf - af;
      return b.additions + b.deletions - (a.additions + a.deletions);
    });
  }

  const groups: SmartDiffGroup[] = roleOrder
    .filter((role) => buckets.get(role)!.length > 0)
    .map((role) => ({ role, files: buckets.get(role)! }));

  const totalLines = files.reduce((s, f) => s + f.additions + f.deletions, 0);
  const tooBig = totalLines > SPLIT_THRESHOLD_LINES;

  const proposedSplits: { name: string; files: string[] }[] = [];
  if (tooBig) {
    const coreFiles = buckets.get('core') ?? [];
    for (let i = 0; i < coreFiles.length; i += SPLIT_CHUNK_SIZE) {
      const chunk = coreFiles.slice(i, i + SPLIT_CHUNK_SIZE);
      proposedSplits.push({
        name: `core-part-${Math.floor(i / SPLIT_CHUNK_SIZE) + 1}`,
        files: chunk.map((f) => f.path),
      });
    }
    const wiringFiles = buckets.get('wiring') ?? [];
    if (wiringFiles.length > 0) {
      proposedSplits.push({
        name: 'wiring-config',
        files: wiringFiles.map((f) => f.path),
      });
    }
  }

  return {
    groups,
    split_suggestion: {
      too_big: tooBig,
      total_lines: totalLines,
      proposed_splits: proposedSplits,
    },
  };
}
