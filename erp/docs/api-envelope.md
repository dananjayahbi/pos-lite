# API Response Envelope Contract (INF-02 / XC-02)

Every JSON response from the ERP API follows ONE shape.

## Success

```jsonc
{ "success": true, "data": <payload>, "meta": { "page": 1, "limit": 20, "total": 137, "hasMore": true } }
```

- `data` for list endpoints is ALWAYS an array. Pagination lives in `meta`
  (optional on non-paginated responses).
- `meta` is only present on paginated list responses.

## Error

```jsonc
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```

- `error.message` is a stable, client-safe string. Raw Prisma/stack internals
  are NEVER returned (logged server-side instead).

## Status-code policy

| Situation | Code |
|---|---|
| Missing / invalid session | **401** `UNAUTHORIZED` |
| Authenticated but lacks permission / role | **403** `FORBIDDEN` |
| Malformed input (body or query param) | **400** `VALIDATION_ERROR` / `BAD_REQUEST` |
| Resource id valid-shape but absent (incl. cross-tenant) | **404** `NOT_FOUND` |
| Duplicate / state conflict (incl. soft-delete unique clash) | **409** `CONFLICT` |
| Unexpected failure | **500** `INTERNAL_SERVER_ERROR` (generic message only) |

Documented exceptions: `/api/internal/*` (Edge middleware bridge) and webhook
receivers authenticate by other means and are exempt from the session rules.

## Query-param policy (XC-01)

- Malformed values (`page=abc`, `from=not-a-date`) → **400** naming the param.
- Valid-but-out-of-range pagination (`page=0`, `limit=99999`) → **clamped**.
- Domain filters (status enums, dates) → rejected with 400 when invalid.

## Decimal / money serialization (INF-04)

- Money fields serialize as **2-dp strings** (`"1890.00"`).
- Request bodies accept string-or-number with ≤2 decimals (`zPrice`).
- Raw Prisma `Decimal` objects never appear in responses.

## Implementation

- Builders + `withApiErrors` / `toErrorResponse`: `src/lib/api/error-envelope.ts`
- `ApiError`: `src/lib/api/errors.ts`
- Prisma mapper: `src/lib/api/map-prisma-error.ts`
- Sentinel mapper: `src/lib/api/map-service-error.ts`
- Query parser: `src/lib/api/query-params.ts`
- Super-admin gate: `src/lib/api/superadmin-guard.ts`
