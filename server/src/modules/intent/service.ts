import type { Container } from '../../platform/container.js';
import type { Intent, Provider } from '@devdigest/shared';
import { Intent as IntentSchema } from '@devdigest/shared';
import { upsertIntent, getIntent } from '../reviews/repository/pull.repo.js';

/**
 * Intent extraction prompt. Receives PR metadata (no code bodies) and returns
 * a structured Intent {intent, in_scope[], out_of_scope[]}.
 *
 * Key design decisions:
 * - Input is title + body + linked issue + file list with hunk headers ONLY.
 *   No change bodies → drastically fewer tokens → cheap flash-class model.
 * - If a plan/spec is embedded in the PR body, the model considers it.
 * - If no documentation at all, the model infers intent from filenames/title.
 */
const SYSTEM_PROMPT = `You are an intent classifier for pull requests.

Your job: produce a concise, accurate summary of WHY this PR exists and WHAT it
aims to change. Think in terms of the developer's goal, not implementation details.

Rules:
- "intent" is 1-3 sentences explaining the motivation.
- "in_scope" lists concrete things this PR is meant to accomplish (3-8 items).
- "out_of_scope" lists things this PR explicitly does NOT address (2-5 items).
  Infer from the file list and description what's intentionally excluded.
- If the PR body contains a plan, spec link, or ticket reference, use it to
  understand the original motivation.
- If there is NO description or body, infer intent from the title and file
  names alone — be honest about lower confidence.
- Keep each item concise (under 15 words).
- Respond ONLY with valid JSON matching the schema.`;

/**
 * Build the user message for intent extraction.
 * Input: PR title, body, linked issue, file list with hunk headers.
 * Intentionally excludes full diff bodies to minimize token cost.
 */
function buildUserMessage(pr: {
  title: string;
  body: string | null;
  linked_issue?: { title: string; body: string | null } | null;
  files: { path: string; additions: number; deletions: number; patch?: string | null }[];
}): string {
  const parts: string[] = [];

  parts.push(`## PR Title\n${pr.title}`);

  if (pr.body?.trim()) {
    parts.push(`## PR Body\n${pr.body}`);
  }

  if (pr.linked_issue) {
    parts.push(
      `## Linked Issue\n**${pr.linked_issue.title}**\n${pr.linked_issue.body ?? '(no body)'}`,
    );
  }

  const fileList = pr.files.map((f) => {
    const hunkHeaders = extractHunkHeaders(f.patch);
    const hunkStr = hunkHeaders.length > 0 ? `  hunks: ${hunkHeaders.join(', ')}` : '';
    return `- ${f.path}  (+${f.additions} −${f.deletions})${hunkStr}`;
  });
  parts.push(`## Changed Files (${pr.files.length})\n${fileList.join('\n')}`);

  return parts.join('\n\n');
}

/**
 * Extract @@ hunk headers from a unified diff patch — the "what functions
 * changed" signals without including code bodies.
 */
function extractHunkHeaders(patch: string | null | undefined): string[] {
  if (!patch) return [];
  const headers: string[] = [];
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ .+? @@\s*(.*)/);
      if (match?.[1]) headers.push(match[1].trim());
    }
  }
  return headers;
}

/** Default model for intent classification — flash-class, cheap. */
const DEFAULT_INTENT_MODEL = 'google/gemini-2.0-flash-001';
const DEFAULT_INTENT_PROVIDER: Provider = 'openrouter';

export class IntentService {
  constructor(private container: Container) {}

  async getIntent(prId: string): Promise<Intent | undefined> {
    return getIntent(this.container.db, prId);
  }

  /**
   * Extract intent for a PR using a cheap flash-class model.
   * Stores the result in pr_intent and returns it.
   */
  async extractIntent(
    prId: string,
    pr: {
      title: string;
      body: string | null;
      linked_issue?: { title: string; body: string | null } | null;
      files: { path: string; additions: number; deletions: number; patch?: string | null }[];
    },
    opts?: { provider?: Provider; model?: string },
  ): Promise<{ intent: Intent; tokensIn: number; tokensOut: number; model: string; costUsd: number | null }> {
    const provider = opts?.provider ?? DEFAULT_INTENT_PROVIDER;
    const model = opts?.model ?? DEFAULT_INTENT_MODEL;

    const llm = await this.container.llm(provider);
    const userMessage = buildUserMessage(pr);

    const result = await llm.completeStructured({
      model,
      schema: IntentSchema,
      schemaName: 'Intent',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      maxRetries: 2,
    });

    const intent = result.data;

    await upsertIntent(this.container.db, prId, intent);
    return {
      intent,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      model: result.model,
      costUsd: result.costUsd,
    };
  }
}
