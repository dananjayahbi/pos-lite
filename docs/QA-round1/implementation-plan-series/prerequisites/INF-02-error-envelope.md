# INF-02 — Central API error envelope + Prisma error mapping

**Type:** prerequisite / cross-cutting · **Severity:** P1 (root cause of a whole defect family) · **Depends on:** nothing · **Blocks:** M04-01, M05-02, M06-01, M08-02, M08-05, M17-01, M24-01, M26-02, M26-03, XC-01, XC-02, and the error-mapping half of M03-05/06, M09-01/02, M10-01, M11-02, M14-02, M15-02, M17-02, M27-05/07, M32-01

## Verified source state (2026-09-15)
- Typed error helpers (`unauthorized/forbidden/validationError/notFound/conflict/badRequest/internalError`) exist **only** in `erp/src/lib/api/delivery-route.ts` (lines 41–88), used by the delivery/rate-card/reconciliation family.
- Every other route family hand-writes `NextResponse.json({ error: { code, message } }, { status })` with slight shape variations (`success` flag present on some, absent on others; `details` array vs object).
- The **`message.includes('already exists')`** catch anti-pattern is live in **9 route files**: `api/store/brands/route.ts:94`, `brands/[id]/route.ts:122`, `categories/route.ts:94`, `categories/[id]/route.ts:122`, `customers/route.ts:103`, `customers/[id]/route.ts:121`, `products/route.ts:183`, `products/[id]/route.ts:126`, `products/[id]/variants/route.ts:76`.
- `mapDeliveryError` (`src/lib/api/delivery-route.ts`, ends ~line 110) has branches only for delivery sentinels; `LEDGER_ENTRY_NOT_FOUND` / `DISPUTE_NOT_FOUND` / `ALREADY_DISPUTED` (from `reconciliation-dispute.service.ts:34-35,87`) fall through to `internalError()` → 500 (BUG-66).

## Defects this doc root-causes (the family)
| Symptom | QA id | Mechanism |
|---|---|---|
| 409 leaks raw Prisma/Turbopack internals (server paths, chunk names, constraint) | BUG-21, BUG-26, BUG-29 | `message.includes('already exists')` matches the Prisma *error dump* (which echoes the source line containing that text) and returns the dump as the client message |
| Decimal/date overflow → 500 instead of 400/409 | BUG-7, BUG-8, BUG-39, BUG-47, BUG-91 | catch-all `internalError` with no Prisma-code branch |
| Routine client error → 500 | BUG-50, BUG-66, BUG-67 | unmapped service sentinels / parse throws |
| Misleading status (409 for a bad date) | BUG-26/29 | same includes-match |

## Goal
One canonical error contract for the whole API, with a single Prisma→HTTP mapper and a single service-sentinel→HTTP mapper, so no route re-implements (or gets wrong) error handling.

## Design (modular)
1. Promote the helpers out of `delivery-route.ts` into a new `erp/src/lib/api/error-envelope.ts` (response builders) + `erp/src/lib/api/errors.ts` (an `ApiError` class carrying `status`, `code`, `message`, `details`). Keep `delivery-route.ts` re-exporting for back-compat so courier routes don't churn.
2. Add `erp/src/lib/api/map-prisma-error.ts`: recognizes `Prisma.PrismaClientKnownRequestError` codes — `P2002`→409 CONFLICT (friendly message derived from the target fields, **never** echoing the raw dump), `P2003`→409/400 (FK), `P2025`→404 NOT_FOUND, numeric/`Range` overflow and invalid-date `P2023`/`Q2009`-family → 400 VALIDATION_ERROR. This is the piece that makes the per-module "→500" bugs disappear.
3. Add `erp/src/lib/api/map-service-error.ts`: maps thrown **sentinel strings** (already used by services: `CATEGORY_IN_USE`, `BRAND_IN_USE`, `NOT_FOUND`, `BELOW_ZERO_STOCK`, `INSUFFICIENT_STOCK`, `CONFLICT`, `COURIER_AUTH_FAILED`, the dispute sentinels, `tenant-mismatch`, etc.) to typed responses. Central registry so new sentinels are added in one place (fixes BUG-66 class once and for all).
4. Introduce a route wrapper `withApiErrors(handler)` (higher-order function) so each route's `catch` is one line; migrate routes incrementally (each module doc migrates its own routes; INF-02 only builds the shared layer + migrates the 9 `already-exists` files listed above as the reference conversion).
5. **Never** return `error.message` from a Prisma/unknown error to the client — log it server-side (Sentry already wired), return a stable friendly message. This single rule kills the information-disclosure family (BUG-21/26/29).

## Anti-goals
- Do not change status codes that are already correct (e.g. category/brand in-use → 409 stays 409; only the *message body* stops leaking).
- Do not refactor business logic in routes — only the catch/throw surface.

## Acceptance / gate
- Unit tests (Vitest, fits existing `src/lib/**/__tests__/`) for the two mappers: P2002→409 friendly, P2025→404, unknown→500 with no internals, each sentinel→correct code.
- The 9 migrated routes: a recreate-after-soft-delete duplicate returns 409 with the **friendly** message and **no** `prisma`/`.next`/`chunk` substrings (flips the BUG-21 assertion in `tests/04_categories_brands.spec.ts` A3 from "acceptable 409" to "409 + clean message").
- `tests/26` dispute unknown-id probes (`F15/F18/R3/S5/X7`) flip from 500-guard to 404/409 once M26-02 registers the sentinels through this mapper.

## Notes
- Coordinate with XC-01 (query-param validation) — that doc adds *input* guards; this doc adds *error* handling. Both live under `src/lib/api/` but are separate files/concerns.
