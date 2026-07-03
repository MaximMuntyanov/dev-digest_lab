/**
 * DevDigest REST client + reference resolvers (infrastructure layer).
 *
 * Tools code against these typed helpers, never against fetch() directly, so the
 * transport details (base URL, error shape, number→uuid resolution) live in one
 * place. All calls are workspace-scoped server-side; no auth header is needed in
 * the local studio.
 */
import { API_BASE } from './config.js';

export interface Agent {
  id: string;
  name: string;
  provider: string;
  model: string;
  enabled: boolean;
  description?: string | null;
}

export interface Repo {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  default_branch: string;
}

export interface Pull {
  id: string;
  number: number;
  title: string;
  status: string;
  files_count?: number;
}

export interface RunTarget {
  run_id: string;
  agent_id: string;
  agent_name: string;
}

export interface RunSummary {
  run_id: string;
  status: string;
  agent_name?: string | null;
  findings_count?: number | null;
  blockers?: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID_RE.test(s);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(
      `Cannot reach DevDigest API at ${API_BASE}. Is the server running? (${(e as Error).message})`,
      0,
      '',
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(`${method} ${path} → ${res.status}`, res.status, text);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
};

// --- Endpoint wrappers ------------------------------------------------------

export const listAgents = () => api.get<Agent[]>('/agents');
export const listRepos = () => api.get<Repo[]>('/repos');
export const listPulls = (repoId: string) => api.get<Pull[]>(`/repos/${repoId}/pulls`);
export const listRuns = (prId: string) => api.get<RunSummary[]>(`/pulls/${prId}/runs`);
export const getReviews = (prId: string) => api.get<unknown[]>(`/pulls/${prId}/reviews`);
export const getBlast = (prId: string) => api.get<unknown>(`/pulls/${prId}/blast`);
export const getConventions = (repoId: string, n?: number) =>
  api.get<{ repo_id: string; count: number; samples: string[] }>(
    `/repos/${repoId}/conventions${n ? `?n=${n}` : ''}`,
  );
export const runReview = (prId: string, agentId: string) =>
  api.post<{ pr_id: string; runs: RunTarget[] }>(`/pulls/${prId}/review`, { agentId });

// --- Reference resolvers (human-friendly inputs → uuids) --------------------

/** Resolve a repo by uuid or by full_name / name (case-insensitive). */
export async function resolveRepo(ref: string): Promise<Repo> {
  const repos = await listRepos();
  if (isUuid(ref)) {
    const byId = repos.find((r) => r.id === ref);
    if (!byId) throw new ApiError(`No repo with id ${ref}`, 404, '');
    return byId;
  }
  const needle = ref.toLowerCase();
  const match = repos.find(
    (r) => r.full_name.toLowerCase() === needle || r.name.toLowerCase() === needle,
  );
  if (!match) {
    const known = repos.map((r) => r.full_name).join(', ');
    throw new ApiError(`No repo matching "${ref}". Known repos: ${known || '(none)'}`, 404, '');
  }
  return match;
}

/** Resolve a PR to its row uuid from either pr_id, or repo + pr_number. */
export async function resolvePrId(args: {
  pr_id?: string;
  repo?: string;
  pr_number?: number;
}): Promise<string> {
  if (args.pr_id) {
    if (!isUuid(args.pr_id)) throw new ApiError(`pr_id must be a uuid, got "${args.pr_id}"`, 400, '');
    return args.pr_id;
  }
  if (args.repo == null || args.pr_number == null) {
    throw new ApiError('Provide pr_id, or both repo and pr_number.', 400, '');
  }
  const repo = await resolveRepo(args.repo);
  const pulls = await listPulls(repo.id);
  const pr = pulls.find((p) => p.number === args.pr_number);
  if (!pr) {
    const nums = pulls.map((p) => `#${p.number}`).join(', ');
    throw new ApiError(
      `${repo.full_name} has no PR #${args.pr_number}. Open PRs: ${nums || '(none)'}`,
      404,
      '',
    );
  }
  return pr.id;
}

/** Resolve an agent by id or by name (case-insensitive). */
export async function resolveAgent(args: { agent_id?: string; agent?: string }): Promise<Agent> {
  const agents = await listAgents();
  if (args.agent_id) {
    const byId = agents.find((a) => a.id === args.agent_id);
    if (!byId) throw new ApiError(`No agent with id ${args.agent_id}`, 404, '');
    return byId;
  }
  if (args.agent) {
    const needle = args.agent.toLowerCase();
    const match = agents.find((a) => a.name.toLowerCase() === needle);
    if (!match) {
      const known = agents.map((a) => a.name).join(', ');
      throw new ApiError(`No agent named "${args.agent}". Agents: ${known}`, 404, '');
    }
    return match;
  }
  throw new ApiError('Provide agent_id or agent (name).', 400, '');
}
