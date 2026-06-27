import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Container } from '../../platform/container.js';
import type { ConventionCandidate, Skill } from '@devdigest/shared';
import { ConventionExtraction } from '@devdigest/shared';
import { ExternalServiceError, NotFoundError, ValidationError } from '../../platform/errors.js';
import { RepoRepository } from '../repos/repository.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { SkillsRepository } from '../skills/repository.js';
import { ConventionsRepository } from './repository.js';

function toCandidateDto(row: {
  id: string;
  rule: string;
  evidencePath: string | null;
  evidenceSnippet: string | null;
  confidence: number | null;
  accepted: boolean;
}): ConventionCandidate {
  return {
    id: row.id,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    accepted: row.accepted,
  };
}

function parseJsonFromCompletion(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1]!.trim() : trimmed;
  return JSON.parse(jsonStr);
}

function validateEvidence(
  clonePath: string,
  evidencePath: string,
  evidenceSnippet: string,
): boolean {
  const fullPath = join(clonePath, evidencePath);
  if (!existsSync(fullPath)) return false;
  try {
    const content = readFileSync(fullPath, 'utf8');
    return content.includes(evidenceSnippet);
  } catch {
    return false;
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You are a code conventions analyzer. Analyze the provided code samples and identify coding conventions in the repository.

Look for patterns such as:
- Naming patterns (variables, functions, classes, files)
- Error handling patterns
- Import/export patterns
- Architecture patterns

For each convention found, provide:
- rule: A clear description of the convention
- evidence_path: The file path where this pattern appears (must match one of the provided files exactly)
- evidence_snippet: An exact verbatim code snippet from that file demonstrating the convention
- confidence: A score from 0 to 1 indicating how confident you are

Respond with ONLY valid JSON in this exact format:
{
  "candidates": [
    {
      "rule": "...",
      "evidence_path": "...",
      "evidence_snippet": "...",
      "confidence": 0.85
    }
  ]
}`;

export class ConventionsService {
  private repo: ConventionsRepository;
  private repos: RepoRepository;
  private skills: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
    this.repos = new RepoRepository(container.db);
    this.skills = new SkillsRepository(container.db);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const rows = await this.repo.list(workspaceId, repoId);
    return rows.map(toCandidateDto);
  }

  async extract(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const repo = await this.repos.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    if (!repo.clonePath) {
      throw new ValidationError('Repo is not cloned yet');
    }

    const filePaths = await this.container.repoIntel.getConventionSamples(repoId, 12);
    const samples: { path: string; content: string }[] = [];
    for (const path of filePaths) {
      const fullPath = join(repo.clonePath, path);
      if (!existsSync(fullPath)) continue;
      try {
        const content = readFileSync(fullPath, 'utf8');
        samples.push({ path, content });
      } catch {
        continue;
      }
    }

    const { provider, model } = await resolveFeatureModel(
      this.container,
      workspaceId,
      'conventions',
    );
    const llm = await this.container.llm(provider);

    const fileSamplesText = samples
      .map((s) => `### File: ${s.path}\n\`\`\`\n${s.content.slice(0, 8000)}\n\`\`\``)
      .join('\n\n');

    const result = await llm.complete({
      model,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze these code samples from the repository and extract coding conventions:\n\n${fileSamplesText}`,
        },
      ],
      temperature: 0.2,
    });

    let extraction: ConventionExtraction;
    try {
      const json = parseJsonFromCompletion(result.text);
      extraction = ConventionExtraction.parse(json);
    } catch {
      throw new ExternalServiceError('Failed to parse LLM response as convention extraction JSON');
    }

    const validCandidates = extraction.candidates.filter((c) =>
      validateEvidence(repo.clonePath!, c.evidence_path, c.evidence_snippet),
    );

    await this.repo.deleteByRepo(workspaceId, repoId);

    const inserted: ConventionCandidate[] = [];
    for (const c of validCandidates) {
      const row = await this.repo.insert({
        workspaceId,
        repoId,
        rule: c.rule,
        evidencePath: c.evidence_path,
        evidenceSnippet: c.evidence_snippet,
        confidence: c.confidence,
      });
      inserted.push(toCandidateDto(row));
    }

    return inserted;
  }

  async updateCandidate(
    workspaceId: string,
    id: string,
    patch: {
      rule?: string;
      evidence_path?: string;
      evidence_snippet?: string;
      confidence?: number;
      accepted?: boolean;
    },
  ): Promise<ConventionCandidate | undefined> {
    const existing = await this.repo.getById(id);
    if (!existing || existing.workspaceId !== workspaceId) return undefined;

    const row = await this.repo.update(id, {
      ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
      ...(patch.evidence_path !== undefined ? { evidencePath: patch.evidence_path } : {}),
      ...(patch.evidence_snippet !== undefined ? { evidenceSnippet: patch.evidence_snippet } : {}),
      ...(patch.confidence !== undefined ? { confidence: patch.confidence } : {}),
      ...(patch.accepted !== undefined ? { accepted: patch.accepted } : {}),
    });
    return row ? toCandidateDto(row) : undefined;
  }

  async createSkillFromAccepted(
    workspaceId: string,
    repoId: string,
    skillName: string,
    description?: string,
  ): Promise<Skill> {
    const accepted = await this.repo.listAccepted(workspaceId, repoId);
    if (accepted.length === 0) {
      throw new ValidationError('No accepted conventions to create skill from');
    }

    const evidenceFiles = [
      ...new Set(accepted.map((c) => c.evidencePath).filter((p): p is string => Boolean(p))),
    ];

    const body = accepted
      .map((c, i) => {
        return `## ${i + 1}. ${c.rule}\n\nEvidence: \`${c.evidencePath}\`\n\n\`\`\`\n${c.evidenceSnippet}\n\`\`\``;
      })
      .join('\n\n');

    const row = await this.skills.insert({
      workspaceId,
      name: skillName,
      description: description ?? 'Coding conventions extracted from repository',
      type: 'convention',
      source: 'extracted',
      body,
      evidenceFiles,
    });

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
}
