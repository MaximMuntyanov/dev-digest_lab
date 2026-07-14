import type { Db } from './client.js';
import * as t from './schema.js';
import { and, eq } from 'drizzle-orm';

/**
 * Demo eval cases (L06) — the "gold set" for the Security Reviewer.
 *
 * Ten cases (≥8 required): six `must_find` real vulnerabilities the agent SHOULD
 * flag, and four `must_not_flag` clean changes it should stay quiet on. The
 * must_not_flag cases are what a broken/over-eager prompt trips on — that is how
 * precision visibly drops in the experiment.
 *
 * Each case carries a self-contained unified-diff fragment (parseable by
 * `parseUnifiedDiff`) plus the expected finding location (file + line range).
 * Idempotent: keyed on (workspace, owner, name).
 */

interface SeedEvalCase {
  name: string;
  expectationKind: 'must_find' | 'must_not_flag';
  file: string;
  startLine: number;
  endLine: number;
  severity: string;
  category: string;
  title: string;
  diff: string;
}

const CASES: SeedEvalCase[] = [
  {
    name: 'stripe-key-leak',
    expectationKind: 'must_find',
    file: 'src/config.ts',
    startLine: 12,
    endLine: 12,
    severity: 'CRITICAL',
    category: 'security',
    title: 'Hardcoded Stripe secret key',
    diff: `--- a/src/config.ts
+++ b/src/config.ts
@@ -12,2 +12,3 @@ export const config = {
+  stripeKey: "sk_live_51H8xq2Ka9Vn3PqLm7Rd0bZ4Xc",
   redisUrl: process.env.REDIS_URL,
 };`,
  },
  {
    name: 'ssrf-webhook-forwarder',
    expectationKind: 'must_find',
    file: 'src/api/public/webhooks.ts',
    startLine: 61,
    endLine: 63,
    severity: 'CRITICAL',
    category: 'security',
    title: 'SSRF: untrusted URL fetched server-side',
    diff: `--- a/src/api/public/webhooks.ts
+++ b/src/api/public/webhooks.ts
@@ -61,1 +61,4 @@ export async function forward(req) {
+  const target = req.body.callbackUrl;
+  const res = await fetch(target);
+  return res.json();
 }`,
  },
  {
    name: 'sql-injection-user-search',
    expectationKind: 'must_find',
    file: 'src/api/users.ts',
    startLine: 88,
    endLine: 89,
    severity: 'CRITICAL',
    category: 'security',
    title: 'SQL injection via string-built query',
    diff: `--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -88,1 +88,3 @@ export async function search(q) {
+  const sql = "SELECT * FROM users WHERE name = '" + q + "'";
+  return db.query(sql);
 }`,
  },
  {
    name: 'hardcoded-jwt-secret',
    expectationKind: 'must_find',
    file: 'src/auth/jwt.ts',
    startLine: 9,
    endLine: 9,
    severity: 'CRITICAL',
    category: 'security',
    title: 'Hardcoded JWT signing secret',
    diff: `--- a/src/auth/jwt.ts
+++ b/src/auth/jwt.ts
@@ -9,2 +9,3 @@ import jwt from "jsonwebtoken";
+const SECRET = "super-secret-signing-key-do-not-change";
 export function sign(payload) {
   return jwt.sign(payload, SECRET);`,
  },
  {
    name: 'command-injection-import',
    expectationKind: 'must_find',
    file: 'src/jobs/import.ts',
    startLine: 22,
    endLine: 23,
    severity: 'CRITICAL',
    category: 'security',
    title: 'Command injection via child_process.exec',
    diff: `--- a/src/jobs/import.ts
+++ b/src/jobs/import.ts
@@ -22,1 +22,3 @@ export function importFile(name) {
+  const cmd = "tar -xf uploads/" + name;
+  exec(cmd);
 }`,
  },
  {
    name: 'path-traversal-download',
    expectationKind: 'must_find',
    file: 'src/api/files.ts',
    startLine: 33,
    endLine: 34,
    severity: 'WARNING',
    category: 'security',
    title: 'Path traversal in file download',
    diff: `--- a/src/api/files.ts
+++ b/src/api/files.ts
@@ -33,1 +33,3 @@ export function download(req, res) {
+  const p = "storage/" + req.query.file;
+  res.sendFile(p);
 }`,
  },
  // ---- must_not_flag: clean changes the agent should stay quiet on ----
  {
    name: 'env-var-refactor-fix',
    expectationKind: 'must_not_flag',
    file: 'src/config.ts',
    startLine: 12,
    endLine: 12,
    severity: 'SUGGESTION',
    category: 'style',
    title: 'Stripe key moved to env var (the fix)',
    diff: `--- a/src/config.ts
+++ b/src/config.ts
@@ -12,2 +12,3 @@ export const config = {
+  stripeKey: process.env.STRIPE_SECRET_KEY,
   redisUrl: process.env.REDIS_URL,
 };`,
  },
  {
    name: 'clean-rename-helper',
    expectationKind: 'must_not_flag',
    file: 'src/utils/format.ts',
    startLine: 4,
    endLine: 5,
    severity: 'SUGGESTION',
    category: 'style',
    title: 'Pure rename of a formatting helper',
    diff: `--- a/src/utils/format.ts
+++ b/src/utils/format.ts
@@ -4,2 +4,2 @@ import { toMoney } from "./money";
-export function fmt(n) {
+export function formatAmount(n) {
   return toMoney(n);`,
  },
  {
    name: 'add-unit-test',
    expectationKind: 'must_not_flag',
    file: 'test/ratelimit.test.ts',
    startLine: 1,
    endLine: 3,
    severity: 'SUGGESTION',
    category: 'test',
    title: 'Added a unit test for the limiter',
    diff: `--- a/test/ratelimit.test.ts
+++ b/test/ratelimit.test.ts
@@ -1,1 +1,4 @@
+import { limiter } from "../src/middleware/ratelimit";
+test("allows under the cap", () => {
+  expect(limiter.check("ip", 1)).toBe(true);
+});`,
  },
  {
    name: 'doc-comment-only',
    expectationKind: 'must_not_flag',
    file: 'src/middleware/ratelimit.ts',
    startLine: 52,
    endLine: 52,
    severity: 'SUGGESTION',
    category: 'style',
    title: 'Doc comment added to the limiter',
    diff: `--- a/src/middleware/ratelimit.ts
+++ b/src/middleware/ratelimit.ts
@@ -52,1 +52,2 @@ export class TokenBucket {
+  /** Refills tokens at a steady rate; thread-safe within the event loop. */
   refill() {`,
  },
];

export async function seedEvalCases(
  db: Db,
  workspaceId: string,
  agentId: string,
): Promise<number> {
  let inserted = 0;
  for (const c of CASES) {
    const [existing] = await db
      .select({ id: t.evalCases.id })
      .from(t.evalCases)
      .where(
        and(
          eq(t.evalCases.workspaceId, workspaceId),
          eq(t.evalCases.ownerId, agentId),
          eq(t.evalCases.name, c.name),
        ),
      );
    if (existing) continue;
    await db.insert(t.evalCases).values({
      workspaceId,
      ownerKind: 'agent',
      ownerId: agentId,
      name: c.name,
      expectationKind: c.expectationKind,
      inputDiff: c.diff,
      expectedOutput: {
        file: c.file,
        start_line: c.startLine,
        end_line: c.endLine,
        severity: c.severity,
        category: c.category,
        title: c.title,
      },
      notes: 'Seeded demo gold-set case',
    });
    inserted++;
  }
  return inserted;
}
