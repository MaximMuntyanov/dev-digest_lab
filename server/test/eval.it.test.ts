import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/** The model always "finds" a hardcoded Stripe key on src/config.ts:11. */
const REVIEW_FIXTURE: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded secret.',
  score: 42,
  findings: [
    {
      id: 'f1',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live key is committed.',
      confidence: 0.95,
      kind: 'finding',
    },
  ],
};

const CONFIG_DIFF = `--- a/src/config.ts
+++ b/src/config.ts
@@ -10,2 +10,3 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const USERS_DIFF = `--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -50,1 +50,2 @@
+  const rows = await loadAll();
   return rows;`;

d('L06 eval pipeline (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(structured: unknown) {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: CONFIG_DIFF }),
        llm: { openai: new MockLLMProvider('openai', { structured }) },
      },
    });
  }

  async function createAgent(app: Awaited<ReturnType<typeof buildApp>>, name: string) {
    return (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name, provider: 'openai', model: 'gpt-4.1', system_prompt: 'sec' },
      })
    ).json();
  }

  it('runs a batch and scores deterministically (recall/precision/citation)', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const agent = await createAgent(app, `EvalAgent-${Date.now()}`);

    // Insert a gold set directly: 1 must_find (hit), 1 must_find (miss), 1 must_not_flag (FP).
    await pg.handle.db.insert(t.evalCases).values([
      {
        workspaceId,
        ownerKind: 'agent',
        ownerId: agent.id,
        name: 'find-secret',
        expectationKind: 'must_find',
        inputDiff: CONFIG_DIFF,
        expectedOutput: { file: 'src/config.ts', start_line: 11, end_line: 11 },
      },
      {
        workspaceId,
        ownerKind: 'agent',
        ownerId: agent.id,
        name: 'find-in-other-file',
        expectationKind: 'must_find',
        inputDiff: USERS_DIFF,
        expectedOutput: { file: 'src/api/users.ts', start_line: 50, end_line: 50 },
      },
      {
        workspaceId,
        ownerKind: 'agent',
        ownerId: agent.id,
        name: 'do-not-flag-clean',
        expectationKind: 'must_not_flag',
        inputDiff: CONFIG_DIFF,
        expectedOutput: { file: 'src/config.ts', start_line: 11, end_line: 11 },
      },
    ]);

    const res = await app.inject({ method: 'POST', url: `/agents/${agent.id}/eval-runs` });
    expect(res.statusCode).toBe(200);
    const batch = res.json();

    expect(batch.cases_total).toBe(3);
    expect(batch.recall).toBe(0.5); // 1 of 2 must_find matched
    expect(batch.precision).toBe(0.5); // TP=1, FP=1
    expect(batch.citation_accuracy).toBeCloseTo(0.6667, 3); // kept 2 / (kept 2 + dropped 1)
    expect(batch.passed).toBe(1);
    expect(batch.results).toHaveLength(3);
    // snapshot of prompt/version for comparability
    expect(batch.agent_version).toBe(1);
    expect(batch.system_prompt).toBe('sec');

    // cases list carries each case's latest result
    const cases = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/eval-cases` })).json();
    expect(cases).toHaveLength(3);
    expect(cases.every((c: { last_result: unknown }) => c.last_result !== null)).toBe(true);

    // history has the run
    const runs = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/eval-runs` })).json();
    expect(runs.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('changing the system prompt moves precision between two runs (experiment)', async () => {
    // Run 1: model finds only the real secret → clean run.
    const app1 = await appWith(REVIEW_FIXTURE);
    const agent = await createAgent(app1, `ExpAgent-${Date.now()}`);
    await pg.handle.db.insert(t.evalCases).values([
      {
        workspaceId,
        ownerKind: 'agent',
        ownerId: agent.id,
        name: 'secret',
        expectationKind: 'must_find',
        inputDiff: CONFIG_DIFF,
        expectedOutput: { file: 'src/config.ts', start_line: 11, end_line: 11 },
      },
      {
        workspaceId,
        ownerKind: 'agent',
        ownerId: agent.id,
        name: 'clean',
        expectationKind: 'must_not_flag',
        inputDiff: USERS_DIFF,
        expectedOutput: { file: 'src/api/users.ts', start_line: 50, end_line: 50 },
      },
    ]);
    const run1 = (await app1.inject({ method: 'POST', url: `/agents/${agent.id}/eval-runs` })).json();
    expect(run1.precision).toBe(1); // only the true positive emitted
    await app1.close();

    // Run 2: "broken" prompt now also flags the clean file (line 50) → false positive.
    const NOISY_FIXTURE: Review = {
      ...REVIEW_FIXTURE,
      findings: [
        ...REVIEW_FIXTURE.findings,
        {
          id: 'f2',
          severity: 'WARNING',
          category: 'bug',
          title: 'Over-eager flag on a clean change',
          file: 'src/api/users.ts',
          start_line: 50,
          end_line: 50,
          rationale: 'noise',
          confidence: 0.4,
          kind: 'finding',
        },
      ],
    };
    const app2 = await appWith(NOISY_FIXTURE);
    const run2 = (await app2.inject({ method: 'POST', url: `/agents/${agent.id}/eval-runs` })).json();
    expect(run2.precision).toBeLessThan(run1.precision); // FP dragged precision down

    // compare two runs side by side
    const cmp = (
      await app2.inject({ method: 'GET', url: `/eval/compare?a=${run1.id}&b=${run2.id}` })
    ).json();
    expect(cmp.a.id).toBe(run1.id);
    expect(cmp.b.id).toBe(run2.id);
    await app2.close();
  });

  it('creates a case from an accepted finding (must_find) and a dismissed one (must_not_flag)', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const agent = await createAgent(app, `FromFinding-${Date.now()}`);

    // set up a PR + review + two findings owned by the agent
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: `r-${Date.now()}`, fullName: `acme/r-${Date.now()}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 1,
        title: 'x',
        author: 'a',
        branch: 'b',
        base: 'main',
        headSha: 'sha',
      })
      .returning();
    const [review] = await pg.handle.db
      .insert(t.reviews)
      .values({ workspaceId, prId: pr!.id, agentId: agent.id, kind: 'review' })
      .returning();
    const [f1] = await pg.handle.db
      .insert(t.findings)
      .values({
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'secret',
        rationale: 'r',
        confidence: 0.9,
      })
      .returning();
    const [f2] = await pg.handle.db
      .insert(t.findings)
      .values({
        reviewId: review!.id,
        file: 'src/util.ts',
        startLine: 3,
        endLine: 3,
        severity: 'SUGGESTION',
        category: 'style',
        title: 'nit',
        rationale: 'r',
        confidence: 0.5,
      })
      .returning();

    await app.inject({ method: 'POST', url: `/findings/${f1!.id}/accept` });
    const caseA = (
      await app.inject({ method: 'POST', url: `/findings/${f1!.id}/eval-case` })
    ).json();
    expect(caseA.expectation_kind).toBe('must_find');
    expect(caseA.owner_id).toBe(agent.id);
    expect(caseA.expected_output.file).toBe('src/config.ts');

    await app.inject({ method: 'POST', url: `/findings/${f2!.id}/dismiss` });
    const caseB = (
      await app.inject({ method: 'POST', url: `/findings/${f2!.id}/eval-case` })
    ).json();
    expect(caseB.expectation_kind).toBe('must_not_flag');

    await app.close();
  });

  it('seed ships >=8 eval cases on the Security Reviewer', async () => {
    const [sec] = await pg.handle.db
      .select({ id: t.agents.id })
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, 'Security Reviewer')));
    const cases = await pg.handle.db
      .select()
      .from(t.evalCases)
      .where(eq(t.evalCases.ownerId, sec!.id));
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });
});
