# M23-02 — BUG-58: packaging list sort order not honored + BUG-57 Decimal-as-string serialization (contract, not corruption)

**Severity:** P3 + P2-adjacent · **Module:** 23 Packaging · **QA pins:** `tests/23_packaging_stock.spec.ts` F6, P1 · **Depends on:** INF-04 (serialization contract)

## Verified source state (2026-09-15)
- **BUG-57 (holds, benignly):** `prisma/schema.prisma:2124` `consumptionPerParcel Decimal? @db.Decimal(6,2)`; `api/store/packaging/route.ts:9-13` returns raw Prisma rows → Decimal JSON-serializes to **string** (`"1.00"`). The app's own client types already tolerate it (`PackagingPageClient.tsx:57`, `PackagingStockTable.tsx:15`: `number | string | null`), so the practical damage is to *external* consumers and strict-equality tests — still a contract violation worth normalizing under INF-04's money/quantity rule (quantity → number or 2-dp string, decided once there).
- **BUG-58 (holds):** `packaging.service.ts:17-22` uses valid `orderBy: [{category:'asc'},{name:'asc'}]` — but QA observed `['POLYMAILER','TAPE','LABEL',…]` out of alphabetical order. Prisma `orderBy` on the *enum* column sorts by the **DB enum's declaration order**, not alphabetically — Postgres native enums sort by OID/label position. So the service's intent (alpha) and the DB's behavior (declaration order) diverge.

## Fix approach
1. **BUG-58:** sort by the *text* of the category, not the enum — either `orderBy: [{ category: { sort: 'asc' } … }]` doesn't help; use raw `sql\`"category"::text asc\`` in orderBy, or sort in the service after fetch (list is small and unpaginated — acceptable), or map categories to a stable display-order constant in `src/lib/constants/` and sort by it. Recommend the display-order constant (also gives the UI a natural grouping order).
2. **BUG-57:** apply INF-04's serializer at the packaging service boundary (DTO with `consumptionPerParcel` as the chosen canonical form); flip P1's pin to the contract.

## Files
- `packaging.service.ts` (order + DTO), `api/store/packaging/route.ts`, `src/lib/api/serialize.ts` (INF-04).

## Acceptance / gate
- F6: documented order (display-constant or ::text alpha — pick one, pin it); P1: type matches INF-04 contract; CRUD/adjustment tests unchanged.
