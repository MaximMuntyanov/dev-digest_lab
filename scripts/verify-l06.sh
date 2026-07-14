#!/usr/bin/env bash
#
# L06 verify — the Eval Pipeline gate.
#
# Runs the server typecheck, the deterministic eval scorer tests (always run,
# no Docker/LLM needed) + the eval route integration tests (auto-skip when
# Docker is unavailable), and the client typecheck.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ [L06] server typecheck"
( cd server && npm run --silent typecheck )

echo "▶ [L06] eval scorer + route tests"
( cd server && npx vitest run test/eval-scorer.test.ts test/eval.it.test.ts )

echo "▶ [L06] client typecheck"
( cd client && npm run --silent typecheck )

echo "✓ [L06] verify green"
