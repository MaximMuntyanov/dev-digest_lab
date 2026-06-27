# Semver Discipline

## Directive
Enforce semantic versioning rules for API changes. Every change to a public API surface must be reflected in the appropriate version bump. Catching version mismatches before release prevents silent breaking changes from reaching consumers who pin by version range.

## Rules
1. **Major bump required** when:
   - A public endpoint is removed or its path changes.
   - A response field is removed or renamed.
   - A response field type changes (string→number, nullable→non-nullable).
   - Accepted request values are narrowed (enum values removed, stricter validation).
   - A status code changes for a documented response.

2. **Minor bump required** when:
   - A new endpoint is added.
   - A new optional field is added to a response.
   - A new optional parameter is added to a request.
   - A new enum value is accepted in input.
   - Behaviour improves in a backward-compatible way.

3. **Patch bump** when:
   - A bug is fixed without changing the API contract.
   - Documentation or internal implementation changes.
   - Performance improvements with no visible API effect.

## Good
```
// package.json BEFORE: "version": "2.3.1"
// Diff removes `GET /users/:id/avatar` endpoint
// package.json AFTER:  "version": "3.0.0"  ← major bump
```

## Bad
```
// package.json BEFORE: "version": "2.3.1"
// Diff removes `GET /users/:id/avatar` endpoint
// package.json AFTER:  "version": "2.3.2"  ← only a patch, should be 3.0.0
```

## Severity guidance
- Breaking change without major version bump → **CRITICAL**
- New endpoint or field without minor bump → **WARNING**
- Missing changelog entry for API change → **SUGGESTION**
