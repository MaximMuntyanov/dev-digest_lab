import type { Container } from '../../platform/container.js';
import type { Skill } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';

function toSkillDto(row: any): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
  };
}

export class SkillsService {
  private repo: SkillsRepository;
  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toSkillDto);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  async create(workspaceId: string, input: { name: string; description: string; type: string; source: string; body: string; enabled?: boolean; evidenceFiles?: string[] }): Promise<Skill> {
    const row = await this.repo.insert({ workspaceId, ...input });
    return toSkillDto(row);
  }

  async update(workspaceId: string, id: string, patch: { name?: string; description?: string; body?: string; enabled?: boolean }): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toSkillDto(row) : undefined;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }
}
