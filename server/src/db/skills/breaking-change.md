# Breaking Change Detection

## Directive
Flag any change that removes, renames, or alters the type/shape of a public API surface that existing consumers depend on. A "breaking change" is one that causes a currently working client to receive an error or unexpected data without changing their code.

## What counts as breaking
- **Endpoint removal**: a route handler is deleted or its path changes.
- **Field removal**: a response field that clients read is removed from the returned object.
- **Field rename**: a response field key changes (`user_name` → `userName`) without an alias period.
- **Type change**: a field changes from `string` to `number`, `array` to `object`, or nullable to non-nullable (or vice versa).
- **Status code change**: a success path returns a different HTTP status (e.g. `200` → `201` or `204` → `200` with body).
- **Required input added**: a previously optional request field becomes required, or a new required field is added to the request body.
- **Enum narrowing**: accepted enum values shrink — clients sending the removed value get a validation error.
- **Method change**: a route switches from `GET` to `POST` or similar.

## Good (non-breaking)
```typescript
// Adding a new optional response field is fine
const response = {
  id: user.id,
  name: user.name,
  avatarUrl: user.avatarUrl, // NEW — additive, non-breaking
};
```

## Bad (breaking)
```typescript
// BEFORE: clients expect { user_name: string }
res.send({ user_name: row.name });

// AFTER: renamed without deprecation — breaks all consumers
res.send({ userName: row.name });
```

## Severity guidance
- Removed endpoint or field that clients depend on → **CRITICAL**
- Type change of a public response field → **CRITICAL**
- New required request field with no default → **CRITICAL**
- Renamed field without alias/deprecation → **CRITICAL**
