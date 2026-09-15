# M05-03 — BUG-27: no DB unique on customer phone → concurrent same-phone creates ALL accepted (duplicate CRM rows)

**Severity:** P2-Major (data integrity in the multi-cashier POS scenario; corrupts lifetime-spend aggregation) · **Module:** 05 Customers · **QA pin:** `tests/05_customers.spec.ts` R2 · **Depends on:** INF-02 (409 mapping), XC-06 (constraint sweep — this is a member)

## Verified source state (2026-09-15) — still holds
- `prisma/schema.prisma` `model Customer` (def `:1219`): only `@@index([tenantId])` (`:1247`) and `@@index([tenantId, phone])` (`:1248`) — **no `@@unique`**.
- `src/lib/services/customer.service.ts:32-38` `createCustomer`: non-atomic `findFirst` (pre-check) then `create`. Under true concurrency all in-flight requests pass the pre-check before any commit → **3×201 with identical phone** (QA observed; sequential path correctly 409s).
- Contrast: Category/Brand have DB `@@unique([tenantId,name])`; Supplier has none at all (M06-01).

## Fix approach
1. **Add the DB constraint:** `@@unique([tenantId, phone])` on `Customer` via a Prisma migration. Pre-flight: the migration must first detect existing duplicate phones (QA runs left some) — write the migration to either (a) fail loudly with a report, or (b) dedupe/soft-merge first. **Decision needed:** are there live duplicate customers in production? If yes, a data-cleanup step precedes the unique (coordinate with the client; do NOT auto-delete customer records).
2. **Map P2002 → 409** in the create route (INF-02), friendly message "A customer with this phone number already exists" (matches the sequential contract that QA F3 already asserts).
3. Keep the service pre-check (fast path for the friendly message on sequential dupes) but it is no longer the *guarantee* — the DB is.

## Files
- new `prisma/migrations/…/migration.sql` (apply via `scripts/apply-sql-migration.mjs` pattern), `schema.prisma`, `src/app/api/store/customers/route.ts` (+ service), INF-02 mapper.

## Acceptance / gate
- `tests/05` R2 flips: 3-way concurrent same-phone → exactly one 201, two 409, zero 500s, no duplicate rows.
- A3 (recreate same phone *after soft delete* → 201) — **verify interaction with the unique**: if soft-deleted rows keep their phone, a `@@unique([tenantId,phone])` would block recreate. Resolve deliberately: either partial-unique (`WHERE deletedAt IS NULL`) to preserve A3, or change A3's expectation. Recommend partial unique index (matches Category/Brand recreate-after-delete = 409 vs Customer's current 201 — pick ONE policy across entities; see XC-05).
