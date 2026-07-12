/**
 * Deterministic diff-group statistics (L03 SmartDiff, lite).
 *
 * Classifies each changed file into core | wiring | boilerplate using path
 * heuristics + repo-intel file rank, and returns per-group counts. This is a
 * cheap, LLM-free summary fed into the brief prompt (never the raw hunks).
 */

export type DiffRole = 'core' | 'wiring' | 'boilerplate';

export interface PrFileStat {
  path: string;
  additions: number;
  deletions: number;
}

export interface DiffGroupStat {
  role: DiffRole;
  files: number;
  additions: number;
  deletions: number;
  /** A few representative paths (most-changed first) for the prompt. */
  top_files: string[];
}

const BOILERPLATE_FILE =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|package\.json|tsconfig[^/]*\.json)$|\.(snap|lock|min\.(js|css)|map)$/i;
const BOILERPLATE_DIR = /(^|\/)(dist|build|out|coverage|__snapshots__|generated|migrations)\//i;
const WIRING_FILE =
  /(^|\/)(index|routes?|config|server|main|app|di|container|bootstrap|wiring)\.[cm]?[jt]sx?$/i;
const WIRING_DIR = /(^|\/)(config|di)\//i;

/** Higher percentile = more depended-on (top 5% ≈ percentile ≥ 95). */
export function classifyFile(path: string): DiffRole {
  if (BOILERPLATE_FILE.test(path) || BOILERPLATE_DIR.test(path)) return 'boilerplate';
  if (WIRING_FILE.test(path) || WIRING_DIR.test(path)) return 'wiring';
  return 'core';
}

const ORDER: DiffRole[] = ['core', 'wiring', 'boilerplate'];

export function computeDiffGroups(
  files: PrFileStat[],
  rankByPath: Map<string, number>,
): DiffGroupStat[] {
  const byRole = new Map<DiffRole, PrFileStat[]>();
  for (const f of files) {
    const role = classifyFile(f.path);
    const list = byRole.get(role) ?? [];
    list.push(f);
    byRole.set(role, list);
  }

  const groups: DiffGroupStat[] = [];
  for (const role of ORDER) {
    const list = byRole.get(role);
    if (!list || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => {
      const ra = rankByPath.get(a.path) ?? 0;
      const rb = rankByPath.get(b.path) ?? 0;
      if (rb !== ra) return rb - ra; // most central first
      return b.additions + b.deletions - (a.additions + a.deletions);
    });
    groups.push({
      role,
      files: list.length,
      additions: list.reduce((n, f) => n + f.additions, 0),
      deletions: list.reduce((n, f) => n + f.deletions, 0),
      top_files: sorted.slice(0, 5).map((f) => f.path),
    });
  }
  return groups;
}
