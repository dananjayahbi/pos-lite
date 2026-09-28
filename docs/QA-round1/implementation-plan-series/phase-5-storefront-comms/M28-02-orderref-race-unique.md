# M28-02 — BUG-98: `orderRef` generation is race-prone AND non-unique (duplicate references observed)

**Severity:** P2-Major · **Module:** 28 Storefront · **QA pin:** `tests/28_storefront.spec.ts` R1 · **Depends on:** XC-06 · **Interacts with:** M28-01 (same service file — implement together)

## Verified source state (2026-09-15) — holds
- `src/lib/services/order.service.ts:20-23` `generateOrderRef`: `prisma.delivery.count({where:{tenantId}})` → `ORD-${year}-${(count+1).padStart(4,'0')}` — read-then-write, **not** in the create transaction (count :36 vs create :55).
- `schema.prisma:1943,1983` — `Delivery.orderRef String` non-unique; only `@@index([tenantId, orderRef])`. QA observed **3 concurrent checkouts all producing ORD-2026-0022**. Duplicate refs break tracking lookups (public track by ref), courier submission, and reconciliation matching (waybill/orderRef/barcode resolution in module 26).

## Fix approach (pick one, recommend (a))
1. **(a) DB sequence per tenant:** a `OrderRefCounter` table (tenantId + year + lastSeq) with an atomic `upsert increment` inside the order transaction, then format `ORD-<year>-<seq zero-padded 4>`; plus `@@unique([tenantId, orderRef])` as the hard backstop (P2002 → retry once). Zero-padded 4 digits overflows at 10k/yr — widen to 6 (coordinate with storefront display + tests' format regex).
2. (b) Postgres sequence per tenant (heavier migration, gaps on rollback — acceptable for refs).
3. Existing duplicates: a one-off cleanup migration that re-numbers colliding rows (QA's 3×ORD-2026-0022 exist in the test DB; production presumably empty — verify).
4. Add the unique constraint FIRST only after dedupe; order matters for migration safety.

## Files
- `order.service.ts`, `prisma/schema.prisma` + migration, cleanup script (apply via `scripts/apply-sql-migration.mjs`).

## Acceptance / gate
- R1 flips: 3 concurrent checkouts → 3 **distinct** refs; unique constraint live (manual duplicate insert fails); tracking by each ref resolves to exactly one order.
