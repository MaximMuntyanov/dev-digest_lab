/**
 * MCP tool definitions (application layer).
 *
 * Five read/act tools over the DevDigest API. Descriptions follow the
 * "verb + when to use + what it returns" shape and stay short (each is part of
 * the model's prompt every turn). Outputs are compacted (only the fields a
 * reviewer needs, with limits) to keep token cost low.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  ApiError,
  getBlast,
  getConventions,
  getReviews,
  listAgents,
  listRuns,
  resolveAgent,
  resolvePrId,
  resolveRepo,
  runReview,
} from './client.js';
import { RUN_WAIT_TIMEOUT_MS } from './config.js';

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const ok = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string): ToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

/** Wrap a handler so API errors become clean tool errors instead of crashes. */
function guard<A>(fn: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      if (e instanceof ApiError) {
        return fail(e.body ? `${e.message}\n${e.body}` : e.message);
      }
      return fail(`Unexpected error: ${(e as Error).message}`);
    }
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SETTLED = new Set(['done', 'failed', 'cancelled', 'canceled', 'error']);

// Shared input fragments so PR-addressing is identical across tools.
const prSelector = {
  pr_id: z.string().optional().describe('PR row uuid (preferred). Or use repo + pr_number.'),
  repo: z.string().optional().describe('Repo uuid or "owner/name" (with pr_number).'),
  pr_number: z.number().int().optional().describe('PR number within repo (with repo).'),
};

export function registerTools(server: McpServer): void {
  // 1) list_agents ----------------------------------------------------------
  server.registerTool(
    'list_agents',
    {
      title: 'List review agents',
      description:
        'List the configured review agents. Use when the user asks which reviewers are available, or to get an agent id/name before running a review. Returns [{id, name, provider, model, enabled}].',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    guard(async () => {
      const agents = await listAgents();
      return ok(
        agents.map((a) => ({
          id: a.id,
          name: a.name,
          provider: a.provider,
          model: a.model,
          enabled: a.enabled,
        })),
      );
    }),
  );

  // 2) run_agent_on_pr ------------------------------------------------------
  server.registerTool(
    'run_agent_on_pr',
    {
      title: 'Run an agent review on a PR',
      description:
        "Run a review agent on a pull request (reuses the product's Structured Reviewer). Use to start a code review. Give the agent by agent_id or agent (name) and the PR by pr_id (or repo + pr_number). Fire-and-forget by default (returns started run ids); pass wait=true to poll until it finishes and return findings counts.",
      inputSchema: {
        ...prSelector,
        agent_id: z.string().optional().describe('Agent uuid. Or use agent (name).'),
        agent: z.string().optional().describe('Agent name, e.g. "Security Reviewer".'),
        wait: z
          .boolean()
          .optional()
          .describe('Poll until the run settles and return findings (default false).'),
      },
      annotations: { readOnlyHint: false },
    },
    guard(async (args) => {
      const [prId, agent] = await Promise.all([resolvePrId(args), resolveAgent(args)]);
      const { runs } = await runReview(prId, agent.id);
      const started = runs.map((r) => ({ run_id: r.run_id, agent: r.agent_name }));

      if (!args.wait) {
        return ok({
          status: 'started',
          pr_id: prId,
          runs: started,
          note: 'Fire-and-forget. Call get_findings later, or re-run with wait=true.',
        });
      }

      const runId = runs[0]?.run_id;
      if (!runId) return ok({ status: 'started', pr_id: prId, runs: started });

      const deadline = Date.now() + RUN_WAIT_TIMEOUT_MS;
      let last: string | undefined;
      while (Date.now() < deadline) {
        await sleep(2000);
        const all = await listRuns(prId);
        const run = all.find((r) => r.run_id === runId);
        last = run?.status;
        if (run && SETTLED.has(run.status)) {
          return ok({
            status: run.status,
            pr_id: prId,
            run_id: runId,
            agent: agent.name,
            findings_count: run.findings_count ?? 0,
            blockers: run.blockers ?? 0,
            hint: 'Use get_findings for the full list.',
          });
        }
      }
      return ok({
        status: 'timeout',
        pr_id: prId,
        run_id: runId,
        last_status: last ?? 'unknown',
        note: `Not settled within ${RUN_WAIT_TIMEOUT_MS / 1000}s; check later with get_findings.`,
      });
    }),
  );

  // 3) get_findings ---------------------------------------------------------
  server.registerTool(
    'get_findings',
    {
      title: 'Get PR review findings',
      description:
        'Get review findings for a pull request (what agents flagged: severity, file:line, title). Use to inspect results. Address the PR by pr_id or repo + pr_number. Optional severity filter and limit.',
      inputSchema: {
        ...prSelector,
        severity: z
          .enum(['CRITICAL', 'WARNING', 'SUGGESTION'])
          .optional()
          .describe('Only return findings of this severity.'),
        limit: z.number().int().min(1).max(200).optional().describe('Max findings (default 50).'),
      },
      annotations: { readOnlyHint: true },
    },
    guard(async (args) => {
      const prId = await resolvePrId(args);
      const reviews = (await getReviews(prId)) as ReviewLike[];
      const limit = args.limit ?? 50;

      let findings = reviews.flatMap((r) =>
        (r.findings ?? []).map((f) => ({
          severity: f.severity,
          title: f.title,
          file: f.file,
          line: f.start_line ?? f.line ?? null,
          category: f.category ?? null,
          agent: r.agent_name ?? null,
        })),
      );
      if (args.severity) findings = findings.filter((f) => f.severity === args.severity);

      const counts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 } as Record<string, number>;
      for (const f of findings) if (f.severity in counts) counts[f.severity]!++;

      return ok({
        pr_id: prId,
        total: findings.length,
        counts,
        findings: findings.slice(0, limit),
        ...(findings.length > limit ? { truncated: findings.length - limit } : {}),
      });
    }),
  );

  // 4) get_blast_radius -----------------------------------------------------
  server.registerTool(
    'get_blast_radius',
    {
      title: 'Get PR blast radius',
      description:
        "Get the Blast Radius impact map for a PR (changed symbols → callers → impacted HTTP endpoints), read from the repo-intel index — no LLM. Use to answer 'what can these changes break?'. Address the PR by pr_id or repo + pr_number.",
      inputSchema: { ...prSelector },
      annotations: { readOnlyHint: true },
    },
    guard(async (args) => {
      const prId = await resolvePrId(args);
      const blast = (await getBlast(prId)) as BlastLike;
      return ok({
        pr_id: prId,
        index_status: blast.index_status,
        degraded: blast.degraded,
        counts: blast.counts,
        symbols: (blast.symbols ?? []).map((s) => ({
          name: s.name,
          kind: s.kind,
          file: s.file,
          callers: (s.callers ?? []).map((c) => `${c.file}:${c.line}`),
        })),
        endpoints: blast.endpoints ?? [],
      });
    }),
  );

  // 5) get_conventions ------------------------------------------------------
  server.registerTool(
    'get_conventions',
    {
      title: 'Get repo conventions',
      description:
        "Get representative high-rank files that illustrate a repository's conventions, from the repo-intel index — no LLM. Use to learn a repo's patterns before reviewing. Give repo (uuid or 'owner/name'); optional n.",
      inputSchema: {
        repo: z.string().describe('Repo uuid or "owner/name".'),
        n: z.number().int().min(1).max(50).optional().describe('How many sample files (default 8).'),
      },
      annotations: { readOnlyHint: true },
    },
    guard(async (args) => {
      const repo = await resolveRepo(args.repo);
      const res = await getConventions(repo.id, args.n);
      return ok({ repo: repo.full_name, count: res.count, samples: res.samples });
    }),
  );
}

// Light shapes for compacting API responses (transport JSON, not strict).
interface FindingLike {
  severity: string;
  title: string;
  file: string;
  start_line?: number | null;
  line?: number | null;
  category?: string | null;
}
interface ReviewLike {
  agent_name?: string | null;
  findings?: FindingLike[];
}
interface BlastCallerLike {
  file: string;
  line: number;
}
interface BlastSymbolLike {
  name: string;
  kind: string;
  file: string;
  callers?: BlastCallerLike[];
}
interface BlastLike {
  index_status: string;
  degraded: boolean;
  counts: unknown;
  symbols?: BlastSymbolLike[];
  endpoints?: string[];
}
