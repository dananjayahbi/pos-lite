# M06-01 — BUG-30 + BUG-31: no duplicate guard on supplier phone OR name (dedup-free directory)

**Severity:** P2-Major (data integrity; fragments PO history / reconciliation) · **Module:** 06 Suppliers · **QA pins:** `tests/06_suppliers.spec.ts` R2, B2 · **Depends on:** INF-02 (409 mapping), XC-06 (constraint sweep)

## Verified source state (2026-09-15) — both hold
- `src/lib/services/supplier.service.ts:37` `createSupplier`: only `validatePhone` (`:38`) then `prisma.supplier.create` (`:44`) — **no duplicate check** on phone or name at all (weaker than Customer, which at least pre-checks).
- `prisma/schema.prisma` `model Supplier` (def `:1252`): only `@@index([tenantId])` (`:1270`) — **no `@@unique`** anywhere.
- Net: sequential OR concurrent creates of the same phone (or same name) all return 201; the supplier directory is effectively dedup-free. Phone is the primary contact key; duplicates silently fragment PO history and reconciliation.

## Fix approach
1. **DB constraints (the guarantee):** add `@@unique([tenantId, phone])` on Supplier via migration. Name uniqueness is a **decision** — Category/Brand enforce `@@unique([tenantId,name])`, but two legitimately-different suppliers could share a name (e.g. common business names). Recommend: unique on phone (contact key), **non-unique** name but a service-level friendly duplicate *warning* path (not a hard 409). Record the client decision.
2. **Service pre-check** (friendly message on sequential dupes): `findFirst` on phone before create → throw `'A supplier with this phone number already exists'`.
3. **Map P2002 → 409** (INF-02) so the concurrent loser gets 409 not 500.
4. Pre-flight the migration for existing duplicate-phone suppliers (QA runs may have left some) — dedupe/retire first, or the unique add fails. Coordinate with client; never auto-delete.

## Files
- `prisma/schema.prisma` + migration, `src/lib/services/supplier.service.ts`, `src/app/api/store/suppliers/route.ts`.

## Acceptance / gate
- `tests/06` R2 flips: 3-way concurrent same-phone → one 201, two 409, zero 500s. B2 (name) flips per the chosen name policy (if unique → 409; if warning-only → stays 201 but a duplicate-flag surfaces). S3 (same phone allowed across tenants) stays green (constraint is tenant-scoped).
