# `@devdigest/mcp` — devdigest-mcp server

A local **MCP server** (stdio) that exposes DevDigest's review capabilities as
tools any MCP client can call — Cursor, Claude Desktop, or the **MCP Inspector**.

It is a **thin client over the `@devdigest/api` REST surface**: no DB, no LLM
keys, no GitHub token live here. Secrets stay in the API's own env; this process
only talks HTTP to a running DevDigest server.

```
MCP client ──stdio──▶ devdigest-mcp ──HTTP──▶ @devdigest/api (:4000) ──▶ Postgres / repo-intel / reviewer-core
```

Onion layering: `src/index.ts` (transport/stdio) → `src/tools.ts` (tool
definitions) → `src/client.ts` (REST client + reference resolvers).

## Tools (5)

| Tool | What it does | Reads/Writes |
|------|--------------|--------------|
| `list_agents` | List configured review agents (`id, name, provider, model, enabled`). | read |
| `run_agent_on_pr` | Run an agent's review on a PR (reuses the Structured Reviewer). Fire-and-forget; `wait=true` polls for findings. | **write** |
| `get_findings` | Findings for a PR (severity, file:line, title); optional `severity`/`limit`. | read |
| `get_blast_radius` | Impact map for a PR (changed symbols → callers → endpoints) from repo-intel; no LLM. | read |
| `get_conventions` | Representative high-rank files that show a repo's conventions; no LLM. | read |

PRs are addressed by `pr_id` (uuid) **or** `repo` (`owner/name` or uuid) +
`pr_number`. Agents by `agent_id` or `agent` (name). The server resolves these
for you.

## Prerequisites

1. A running DevDigest API. From the repo root:
   ```sh
   cd server && pnpm dev           # API on :4000 (see server/.env → API_PORT)
   ```
   (Needs Postgres up — `docker compose up -d` — and at least one indexed repo.)
2. Install this package:
   ```sh
   cd mcp && pnpm install
   ```

Point the server at a non-default API with `DEVDIGEST_API_BASE`
(default `http://localhost:4000`).

## Run it standalone

```sh
cd mcp
DEVDIGEST_API_BASE=http://localhost:4000 pnpm start
```
It speaks JSON-RPC over stdio and logs readiness to **stderr**.

## Test with MCP Inspector

```sh
cd mcp
DEVDIGEST_API_BASE=http://localhost:4000 pnpm inspect
# equivalent to: npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Then in the Inspector UI:

1. **Connect** (transport: STDIO — already wired by the command above).
2. **List Tools** → you should see the **5 tools**.
3. Call **`list_agents`** (no args) → the configured reviewers.
4. Call **`run_agent_on_pr`** with e.g.
   ```json
   { "repo": "owner/name", "pr_number": 3, "agent": "Security Reviewer" }
   ```
   → returns the started `run_id`. (Add `"wait": true` to block for findings —
   requires an LLM key set in `server/.env`.)
5. Optionally **`get_findings`**, **`get_blast_radius`**, **`get_conventions`**.

## Use from Cursor / Claude Desktop

Add to your MCP config (`~/.cursor/mcp.json` or Claude Desktop config):

```json
{
  "mcpServers": {
    "devdigest": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/dev-digest_lab/mcp",
      "env": { "DEVDIGEST_API_BASE": "http://localhost:4000" }
    }
  }
}
```

## Notes

- `run_agent_on_pr` is fire-and-forget by default (the API runs the review in the
  background). To actually produce findings the API needs an LLM key
  (`OPENROUTER_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`) in
  `server/.env`; without it the run is created but fails.
- All outputs are compacted (only the fields a reviewer needs, with limits) to
  keep token usage low at the call site.
