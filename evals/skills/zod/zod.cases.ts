import type { SkillCase } from "../../src/index.js";

// The zod skill (.claude/skills/zod) codifies 43 rules across 8 categories. Quality cases run
// content-only (no tools — skillTask injects SKILL.md as system prompt and measures its CONTENT
// in isolation), so the prompt inlines a concrete, hostile-input scenario the model must solve
// with actual Zod code. The practices below were curated down to the ones this skill specifically
// codifies AND a bare haiku model tends to miss (coerce for query strings, flatten for form
// errors, discriminatedUnion for a tagged payload) — a well-known "safeParse over parse" or
// "z.infer over hand-written interface" is kept because it still yields a verbatim citation and
// anchors the judge, but the discriminating lift lives in the query/error/union practices.

const SCENARIO = `Here is the endpoint I need validated — treat these field descriptions as the spec and produce the Zod code directly (do not ask for the real file or more context).

Fastify route: POST /repos/:repoId/webhooks/github
- It receives an UNTRUSTED JSON body straight from GitHub (never assume the shape is correct).
- The body has a discriminator field "event" that is one of: "pull_request", "push", "issue_comment".
  * event="pull_request": { event, action: string, number: number, title: string, author_email: string }
  * event="push": { event, ref: string, commits: number }
  * event="issue_comment": { event, comment_id: number, body: string }
- The query string carries pagination + filters that arrive as raw strings from the URL:
  ?page (a positive integer) &per_page (1..100) &drafts (a boolean flag)
- On validation failure the handler must return a per-field error object to the client UI, not a raw exception or a single message.
- The rest of the codebase consumes a TypeScript type for the parsed body; do not hand-maintain a second copy of that type.

Write: the Zod schema(s) for the body and the query, the request-validation code inside the handler, the error response shaping, and the exported TypeScript type for the parsed body.`;

export const cases: SkillCase[] = [
  {
    name: "validates an untrusted webhook body + query the way the zod skill prescribes",
    kind: "quality",
    prompt: SCENARIO,
    // Cheap deterministic gate: the answer must actually be Zod code before we pay the judge.
    grounding: ["z.object"],
    practices: [
      "parses the untrusted request body with safeParse() (or safeParseAsync) and branches on result.success, rather than calling .parse() which throws on bad input",
      "models the tagged body as a z.discriminatedUnion on the \"event\" field, rather than a plain z.union, a loose z.object with optional fields, or an if/else on event after parsing",
      "uses z.coerce (e.g. z.coerce.number() / z.coerce.boolean()) for the query-string params, acknowledging that page/per_page/drafts arrive as strings from the URL",
      "shapes the validation failure with .flatten() (or the fieldErrors it yields) to return a per-field error object, instead of returning the raw ZodError or only error.issues[0].message",
      "derives the parsed-body TypeScript type with z.infer<typeof Schema> and exports it, rather than declaring a separate hand-written interface that duplicates the schema",
    ],
    threshold: 0.6,
    maxTurns: 10,
  },
];
