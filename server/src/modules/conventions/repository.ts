import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export class ConventionsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string, repoId: string) {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(t.conventions).where(eq(t.conventions.id, id));
    return row;
  }

  async listAccepted(workspaceId: string, repoId: string) {
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.accepted, true),
        ),
      );
  }

  async insert(values: {
    workspaceId: string;
    repoId: string;
    rule: string;
    evidencePath: string;
    evidenceSnippet: string;
    confidence: number;
    accepted?: boolean;
  }) {
    const [row] = await this.db
      .insert(t.conventions)
      .values({
        workspaceId: values.workspaceId,
        repoId: values.repoId,
        rule: values.rule,
        evidencePath: values.evidencePath,
        evidenceSnippet: values.evidenceSnippet,
        confidence: values.confidence,
        accepted: values.accepted ?? false,
      })
      .returning();
    return row!;
  }

  async update(
    id: string,
    patch: {
      rule?: string;
      evidencePath?: string;
      evidenceSnippet?: string;
      confidence?: number;
      accepted?: boolean;
    },
  ) {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.evidencePath !== undefined ? { evidencePath: patch.evidencePath } : {}),
        ...(patch.evidenceSnippet !== undefined ? { evidenceSnippet: patch.evidenceSnippet } : {}),
        ...(patch.confidence !== undefined ? { confidence: patch.confidence } : {}),
        ...(patch.accepted !== undefined ? { accepted: patch.accepted } : {}),
      })
      .where(eq(t.conventions.id, id))
      .returning();
    return row;
  }

  async deleteByRepo(workspaceId: string, repoId: string) {
    await this.db
      .delete(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }
}
