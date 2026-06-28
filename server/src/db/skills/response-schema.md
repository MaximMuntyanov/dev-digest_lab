# Response Schema Consistency

## Directive
Ensure that every API endpoint's actual response matches its declared schema. Detect drift between what the code returns and what the schema (Zod, JSON Schema, or TypeDoc) promises. Inconsistencies cause runtime errors in typed clients and break contract-first development.

## What to check
- **Missing fields**: the schema declares a field but the handler never sets it — clients receive `undefined` where they expect a value.
- **Extra fields**: the handler returns fields not in the schema — these leak internal state and may be stripped by serializers, causing confusion.
- **Nullability mismatch**: schema says `required` but code returns `null`/`undefined`, or schema allows `null` but code always returns a value (misleading).
- **Type mismatch**: schema says `number` but code returns a string (e.g. from a DB text column).
- **Nested shape drift**: a nested object or array-item schema doesn't match the actual return shape.
- **Enum completeness**: response includes an enum value not listed in the schema.

## Good
```typescript
const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  created_at: z.string().datetime(),
});

// Handler returns exactly the declared shape
return {
  id: user.id,
  name: user.name,
  email: user.email,
  created_at: user.createdAt.toISOString(),
};
```

## Bad
```typescript
const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  // email is NOT in the schema
});

// Handler returns extra field AND misses type conversion
return {
  id: user.id,
  name: user.name,
  email: user.email,            // leaked — not in schema
  created_at: user.createdAt,   // Date object, schema expects string
};
```

## Severity guidance
- Schema says non-nullable but code returns null → **CRITICAL**
- Type mismatch (schema says X, code returns Y) → **WARNING**
- Extra undeclared fields in response → **WARNING**
- Missing optional field from schema → **SUGGESTION**
