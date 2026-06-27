# Deprecation Policy

## Directive
Enforce a proper deprecation lifecycle for API endpoints and fields. Public API surfaces must never be removed silently — consumers need notice, a migration path, and a sunset timeline. Abrupt removal breaks production clients.

## Required deprecation lifecycle
1. **Announce**: mark the endpoint/field as deprecated with `@deprecated` JSDoc, a `Deprecated` response header, or a `Sunset` header with a target date.
2. **Document**: add a changelog or migration guide entry explaining what replaces the deprecated surface.
3. **Grace period**: keep the deprecated surface functional for at least one release cycle (or the documented sunset period).
4. **Remove**: only after the grace period has passed, remove the deprecated item and bump the major version.

## What to flag
- **Silent removal**: an endpoint or response field disappears from the code with no deprecation notice in any prior version. This is the most common violation.
- **Missing sunset header**: a deprecated endpoint that doesn't include `Sunset` or `Deprecation` headers so clients can detect it programmatically.
- **Premature removal**: removing a deprecated item before the announced sunset date.
- **No replacement documented**: deprecating without telling consumers what to use instead.
- **Deprecated without marking**: the PR description says "deprecated" but the code doesn't add `@deprecated` JSDoc or response headers.

## Good
```typescript
/**
 * @deprecated Use GET /v2/users/:id instead. Sunset: 2025-06-01.
 */
app.get('/v1/users/:id', async (req, reply) => {
  reply.header('Sunset', 'Sat, 01 Jun 2025 00:00:00 GMT');
  reply.header('Deprecation', 'true');
  reply.header('Link', '</v2/users/:id>; rel="successor-version"');
  // ... still functional
});
```

## Bad
```typescript
// BEFORE (v2.3): GET /users/:id/preferences existed and returned user prefs
// AFTER (v2.4):  the route handler is simply deleted — no deprecation, no notice
// Consumers calling this endpoint now get 404 with no warning
```

## Severity guidance
- Endpoint or field silently removed (no prior deprecation) → **CRITICAL**
- Deprecated without `Sunset` header or JSDoc → **WARNING**
- Removal before announced sunset date → **WARNING**
- Missing migration documentation for deprecated surface → **SUGGESTION**
