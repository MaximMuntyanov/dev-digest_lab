---
name: engineering-insights
description: Capture a newly discovered, non-obvious engineering insight into INSIGHTS.md. Use this skill ONLY when the user has just figured out the root cause of a bug or a surprising behavior and wants to record it so the team does not hit it again (e.g. "I just found out why X was happening", "let's write this down", "capture this gotcha"). Do NOT use it to merely explain, teach, or answer a how-does-X-work question — explaining a topic is not a discovery worth persisting.
---

# Engineering Insights

Persist hard-won, non-obvious findings so the next session starts from them instead of
rediscovering the same trap.

## When to activate

Activate when BOTH hold:

- the user has **just discovered** something (a root cause, a gotcha, a surprising
  interaction) — not asked to be taught a concept, and
- the finding is **non-obvious**: it would not be guessed from the code or the docs alone.

Do **not** activate for: general explanations, tutorials, "how does X work" questions, or
restating something already documented. A request to *explain* a topic is a near-miss — stay
silent.

## What to record

Append an entry to `INSIGHTS.md` at the repo root:

- **Symptom** — what looked wrong (the observable behavior).
- **Root cause** — the actual non-obvious reason.
- **Fix / guard** — what to do, and how to avoid re-hitting it.
- **Evidence** — the `file:line`, query, or trace that proves it.

Keep it to a few lines, concrete, and searchable. One insight per entry.
