#!/usr/bin/env -S npx tsx
/**
 * devdigest-mcp — MCP server entrypoint (transport layer).
 *
 * Exposes DevDigest's review capabilities as MCP tools over stdio, so any MCP
 * client (Claude Desktop, Cursor, MCP Inspector) can list agents, run a review
 * on a PR, read findings, read the blast radius, and read repo conventions.
 *
 * Onion: index.ts (transport) → tools.ts (application) → client.ts (infra/API).
 * Logs go to stderr only — stdout is the JSON-RPC channel for stdio transport.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';
import { API_BASE } from './config.js';

async function main(): Promise<void> {
  const server = new McpServer(
    { name: 'devdigest-mcp', version: '0.1.0' },
    {
      instructions:
        'Tools for DevDigest AI code review. Discover reviewers with list_agents, ' +
        'start a review with run_agent_on_pr, then inspect results with get_findings. ' +
        'Use get_blast_radius for the impact map of a PR and get_conventions to learn a ' +
        'repo. PRs can be addressed by pr_id or by repo + pr_number.',
    },
  );

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[devdigest-mcp] ready (stdio) · API_BASE=${API_BASE}`);
}

main().catch((err) => {
  console.error('[devdigest-mcp] fatal:', err);
  process.exit(1);
});
