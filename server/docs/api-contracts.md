# API & Architecture Contracts (server/)

Documented structural rules for `server/` and the domain it composes. Each rule has a
**stable identifier** — the architecture-reviewer (and any eval) must cite the identifier,
not just describe the problem in prose.

## Layering (onion)

Requests flow **routes → service → repository/facade → adapters**. Dependencies point
**inward only**: Domain knows nothing about Presentation (Fastify/HTTP) or Infrastructure
(Postgres/Drizzle, GitHub).

### `inward-only-dependencies`

A Domain module (`**/domain/**`, pure business types/logic) must **not** import from an
outer layer — no `fastify`, no `drizzle-orm`, no `pg`, no `@devdigest/*` transport types.
If domain code needs to signal an outcome, it returns a value or throws a domain error; it
never imports `FastifyReply`/`FastifyRequest`.

> Violation example: `import type { FastifyReply } from "fastify"` inside
> `server/src/modules/**/domain/*.ts`.

### `di-discipline`

Concrete adapters and repositories (`PgXxxRepository`, HTTP clients, LLM providers) are
constructed **only in the composition root / DI container** and injected. A service must
receive its collaborators (via constructor/params), never `new` a concrete repository
inside itself.

> Violation example: `private repo = new PgCheckoutRepository()` inside a service class.
> Fix: inject it — `constructor(private repo: CheckoutRepository) {}` and wire the concrete
> in the container.

## Routes

- Every route validates `params` / `querystring` / `body` with a **shared zod contract**
  from `vendor/shared/contracts/*` — no ad-hoc inline duplicate schemas.
- Every data route is **workspace-scoped**: resolve `workspaceId` and filter by it; never
  read another tenant's rows.
- Never go silent on degraded state: return an explicit empty/degraded payload, not a 500.

## Read When

- Adding or changing an **HTTP endpoint / route** → read this file first.
- Reviewing a change for **layering / DI / boundaries** → cite the identifiers above.
