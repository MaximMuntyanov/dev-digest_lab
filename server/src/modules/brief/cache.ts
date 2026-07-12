import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import type { Brief } from '@devdigest/shared';
import * as t from '../../db/schema.js';

/**
 * Per-PR brief cache, stored in the existing `pr_brief` jsonb table.
 *
 * Bumped whenever the stored shape changes so a stale entry from the old
 * `PrBrief` ({intent,blast,risks,history}) is treated as a miss instead of being
 * mis-parsed. The cache is keyed by `head_sha` AND an input fingerprint (see
 * service) so a brief is reused only when nothing that feeds it has changed.
 */
export const BRIEF_CACHE_VERSION = 2;

export interface BriefCacheEntry {
  v: number;
  /** sha256 over the assembled model input + model id (invalidates on drift). */
  fingerprint: string;
  brief: Brief;
}

export async function getBriefCache(db: Db, prId: string): Promise<BriefCacheEntry | undefined> {
  const [row] = await db.select().from(t.prBrief).where(eq(t.prBrief.prId, prId));
  if (!row) return undefined;
  const entry = row.json as Partial<BriefCacheEntry> | null;
  if (!entry || entry.v !== BRIEF_CACHE_VERSION || !entry.brief || !entry.fingerprint) {
    return undefined;
  }
  return entry as BriefCacheEntry;
}

export async function upsertBriefCache(db: Db, prId: string, entry: BriefCacheEntry): Promise<void> {
  await db
    .insert(t.prBrief)
    .values({ prId, json: entry })
    .onConflictDoUpdate({ target: t.prBrief.prId, set: { json: entry } });
}
