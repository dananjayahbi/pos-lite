# M17-01 — BUG-50: cross-tenant return submission returns unhandled 500 (tenant-mismatch error unmapped)

**Severity:** P2-Major (security boundary must fail closed with a typed response) · **Module:** 17 Returns · **QA pin:** `tests/17_returns_refunds.spec.ts` (cross-tenant) · **Depends on:** INF-02 (sentinel mapping)

## Verified source state (2026-09-15) — still holds
- `src/lib/services/return.service.ts:52-53` `validateReturnEligibility` throws `Error('Authorization error: sale does not belong to this tenant')` on a foreign `originalSaleId`.
- `src/app/api/store/returns/route.ts` POST catch (108-124) maps only: `'Return window expired'`, `'Cannot return'`, `'Sale status must be'`, `'Sale not found'` → 422 UNPROCESSABLE. The tenant-mismatch message matches none → falls through → **500 INTERNAL_SERVER_ERROR** (line 124).
- Also note lines 112-117: the whole error-mapping approach is `message.includes(...)` string matching — the exact anti-pattern INF-02 replaces.

## Fix approach
1. Throw a typed sentinel from the service (`FORBIDDEN_TENANT_MISMATCH` or reuse the established convention: cross-tenant references should surface as **404 NOT_FOUND** — the app's documented multi-tenant semantics; QA's expectation list accepts 403/404/422 — recommend 404 to avoid sale-existence disclosure).
2. Register the sentinel in INF-02's `map-service-error`; route catch delegates to it.
3. Sweep sibling throws in `return.service.ts` (67, 77, 81, 88 — line-ownership, qty>0, over-return) so each maps to a typed code instead of substring matching.

## Files
- `src/lib/services/return.service.ts`, `src/app/api/store/returns/route.ts`, `src/lib/api/map-service-error.ts`.

## Acceptance / gate
- `tests/17` cross-tenant pin flips: tenant-2 owner returning tenant-1's sale → 404 (not 500), no state change; over-return/window/status 422 pins stay green.
