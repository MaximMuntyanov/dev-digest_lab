import { and, eq, desc } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export class SkillsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string) {
    return this.db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId));
  }

  async getById(workspaceId: string, id: string) {
    const [row] = await this.db.select().from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  async insert(values: { workspaceId: string; name: string; description: string; type: string; source: string; body: string; enabled?: boolean; evidenceFiles?: string[] }) {
    const [row] = await this.db.insert(t.skills).values({
      workspaceId: values.workspaceId,
      name: values.name,
      description: values.description,
      type: values.type as any,
      source: values.source as any,
      body: values.body,
      enabled: values.enabled ?? true,
      evidenceFiles: values.evidenceFiles ?? null,
    }).returning();
    return row!;
  }

  async update(workspaceId: string, id: string, patch: { name?: string; description?: string; body?: string; enabled?: boolean }) {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;
    const bodyChanged = patch.body !== undefined && patch.body !== existing.body;
    const nextVersion = bodyChanged ? existing.version + 1 : existing.version;
    const [row] = await this.db.update(t.skills).set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(bodyChanged ? { version: nextVersion } : {}),
    }).where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id))).returning();
    if (bodyChanged && row) {
      await this.db.insert(t.skillVersions).values({
        skillId: row.id, version: nextVersion, body: row.body,
      }).onConflictDoNothing();
    }
    return row;
  }

  async deleteById(workspaceId: string, id: string) {
    const rows = await this.db.delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }
}
