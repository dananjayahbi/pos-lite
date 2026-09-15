# M04-01 — BUG-21: 409 CONFLICT responses leak raw Prisma/Turbopack internals

**Severity:** P3-Minor (information disclosure; status code itself is correct) · **Module:** 04 Categories & Brands · **QA pin:** `tests/04_categories_brands.spec.ts` A3 · **Depends on:** INF-02 (this is the reference module application of it)

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/categories/route.ts:94` POST catch: `if (message.includes('already exists'))` → returns 409 with the **raw** `message`.
- `src/lib/services/product.service.ts:635` `createCategory` pre-check filters `deletedAt: null` (live rows only). A soft-deleted row keeps the name (`@@unique([tenantId,name])` at `schema.prisma:732`), so the pre-check misses it and `prisma.category.create` throws `P2002` — whose dump contains the substring "already exists" (echoed source line), so the catch matches and returns the whole Prisma/Turbopack dump (server paths, chunk names, constraint) as the 409 message.
- **Same for brands:** `brands/route.ts:94`; `product.service.ts:764` `createBrand` pre-check `deletedAt:null`; unique `schema.prisma:750`.

## Fix approach
1. Route both through INF-02's `map-prisma-error`: `P2002` → 409 with the **friendly** message ("A category with this name already exists"), derived from the target fields, never echoing the raw dump.
2. Optionally make the pre-check name-agnostic of `deletedAt` (a soft-deleted name IS taken) so the friendly 409 comes from the service, not the DB — but the mapper is the safety net regardless (belt-and-braces per INF-02).
3. The status code stays 409 — QA A3 already accepts 409; only the *body* must stop leaking.

## Files
- `src/app/api/store/categories/route.ts`, `brands/route.ts`, `[id]` variants (`:122` each), `product.service.ts` (createCategory/createBrand), leveraging `src/lib/api/map-prisma-error.ts`.

## Acceptance / gate
- `tests/04` A3 flips to assert 409 **and** that the message contains no `prisma`/`.next`/`chunk`/`tenantId", "name"` substrings.
- Same assertion pattern reused by M05-02 (customers birthday leak) and M08-05 (plans) — this doc is the template.
