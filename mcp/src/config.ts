/**
 * Runtime config for devdigest-mcp.
 *
 * The MCP server is a thin client over the DevDigest REST API (`@devdigest/api`).
 * Point it at a running API with DEVDIGEST_API_BASE (default matches this repo's
 * server/.env → :4000). Secrets/keys stay in the API's own env — the MCP server
 * never handles LLM/GitHub credentials.
 */
export const API_BASE =
  process.env.DEVDIGEST_API_BASE?.replace(/\/+$/, '') ??
  process.env.DEVDIGEST_API_URL?.replace(/\/+$/, '') ??
  'http://localhost:4000';

/** Max seconds run_agent_on_pr will poll when wait=true. */
export const RUN_WAIT_TIMEOUT_MS = Number(process.env.DEVDIGEST_RUN_TIMEOUT_MS ?? 120_000);
