import type { Container } from '../../platform/container.js';
import type { PrBlast, BlastCallerRow, BlastSymbolGroup } from '@devdigest/shared';

/**
 * Blast Radius — application layer (onion: routes → service → repoIntel facade).
 *
 * READ-ONLY: the whole map is composed from the pre-built repo-intel index via
 * the `repoIntel` facade. No index writes, no diff parsing, and NO LLM call at
 * request time — just:
 *   1. symbols declared in the changed files,
 *   2. their callers (who imports/calls them), rank-sorted, declaration file
 *      excluded, capped by the facade,
 *   3. HTTP endpoints + cron jobs reachable from those files.
 *
 * A partial/degraded index is surfaced honestly (flag + reason) rather than as
 * an empty screen, so the UI can render a badge.
 */
export async function getPrBlast(
  container: Container,
  repoId: string,
  changedFiles: string[],
): Promise<PrBlast> {
  const [blast, indexState] = await Promise.all([
    container.repoIntel.getBlastRadius(repoId, changedFiles),
    container.repoIntel.getIndexState(repoId),
  ]);

  // Group callers under the changed symbol they reach (level: symbol → callers),
  // rank-sorted so the most depended-on caller files surface first.
  const callersBySymbol = new Map<string, BlastCallerRow[]>();
  for (const c of blast.callers) {
    const list = callersBySymbol.get(c.viaSymbol) ?? [];
    list.push({
      file: c.file,
      symbol: c.symbol,
      via_symbol: c.viaSymbol,
      line: c.line,
      rank: c.rank,
    });
    callersBySymbol.set(c.viaSymbol, list);
  }

  const symbols: BlastSymbolGroup[] = blast.changedSymbols.map((s) => ({
    file: s.file,
    name: s.name,
    kind: s.kind,
    callers: (callersBySymbol.get(s.name) ?? []).sort((a, b) => b.rank - a.rank),
  }));

  // Impacted cron/scheduled jobs come from per-caller-file facts (endpoints are
  // already unioned into `impactedEndpoints` by the facade).
  const cronSet = new Set<string>();
  if (blast.factsByFile) {
    for (const facts of Object.values(blast.factsByFile)) {
      for (const cron of facts.crons) cronSet.add(cron);
    }
  }
  const crons = [...cronSet];
  const endpoints = blast.impactedEndpoints;

  const degraded =
    Boolean(blast.degraded) ||
    indexState.status === 'degraded' ||
    indexState.status === 'failed';
  const reason = blast.reason ?? indexState.degradedReason ?? null;

  return {
    index_status: indexState.status,
    degraded,
    reason,
    changed_symbols: blast.changedSymbols.map((s) => ({
      file: s.file,
      name: s.name,
      kind: s.kind,
    })),
    symbols,
    endpoints,
    crons,
    counts: {
      symbols: blast.changedSymbols.length,
      callers: blast.callers.length,
      endpoints: endpoints.length,
      crons: crons.length,
    },
  };
}
