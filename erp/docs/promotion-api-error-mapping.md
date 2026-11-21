# Promotion API error mapping

ARGUS #328. Two client-error paths used to surface as an untyped 500:

1. a malformed date (for example `"not-a-date"`) reached Prisma as an
   `Invalid Date` and failed inside the query;
2. a PATCH against a promotion that belonged to another tenant (or did not
   exist) let Prisma's `P2025` escape the route's blanket catch.

## Contract

`POST/PATCH/DELETE /api/store/promotions*` now use the shared
`toErrorResponse` envelope (`src/lib/api/error-envelope.ts`):

- malformed `startsAt` / `endsAt` -> `400` with code `VALIDATION_ERROR`, a
  message naming the field, and the field path in zod issues;
- unknown or foreign-tenant promotion id -> `404` with code `NOT_FOUND` (a
  foreign id is deliberately indistinguishable from a missing one);
- duplicate promo code -> `409` with code `CONFLICT`;
- unexpected failures -> generic `500` with no internals.

The service loads the promotion tenant-scoped with `findFirst({ id, tenantId })`
before writing and throws `ApiError.notFound`, rather than relying on a
Prisma update to fail. The status-only Activate/Deactivate path uses the same
404.

## Verification

- `src/lib/validators/__tests__/promotion.validators.test.ts` (malformed date
  is a validation issue, not a parse that reaches the service)
- `src/lib/services/__tests__/promotionWindow.core.test.ts`
- `tests/15_promotions_pricing.spec.ts` T1 pins `400 VALIDATION_ERROR`; S2
  pins `404` for a cross-tenant PATCH.
