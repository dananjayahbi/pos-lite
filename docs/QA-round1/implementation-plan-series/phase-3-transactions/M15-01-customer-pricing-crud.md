# M15-01 — BUG-46: `CustomerPricingRule` has a model + evaluation engine but NO CRUD API — customer-specific pricing is unreachable

**Severity:** P2-Major (req 15 "customer pricing" half-dead) · **Module:** 15 Promotions/Pricing · **QA pin:** `tests/15_promotions_pricing.spec.ts` F9 · **Depends on:** INF-02 (mapping), M05 (tag model it keys off)

## Verified source state (2026-09-15) — still holds
- No route directory matching `customer-pricing*` under `src/app/api/store/` (glob-confirmed) → `POST /api/store/customer-pricing-rules` → 404.
- Yet `src/lib/services/promotion.service.ts:98-112` `evaluateCustomerPricing` queries `prisma.customerPricingRule.findMany` and is wired into cart evaluation (`:376`) — the engine runs, but nothing can ever populate it (tagged customers can't get variant-specific prices through the app).

## Fix approach (build the missing CRUD, mirroring the promotions family)
1. `src/lib/validators/customer-pricing.validators.ts`: tenant-scoped fields per the Prisma model (customerTag or customerId? + variantId, price or discount, validFrom/To, isActive — read the model first; keep parity with Promotion's date-window semantics).
2. Routes: `src/app/api/store/customer-pricing-rules/route.ts` (GET list + POST) and `[id]/route.ts` (GET/PATCH/soft-deactivate) — permission keys from the promotions family (`PROMOTION.*` or a new `pricing:manage` — align with `ROLE_PERMISSIONS`; MANAGER+ likely).
3. Uniqueness: prevent overlapping rules for same (tag/customer, variant, window) — 409 via INF-02 (avoid a BUG-27-style race: DB unique where possible).
4. UI: extend the promotions page with a "Customer pricing" tab (new component file under `src/components/promotions/`, not an append to the promotions table).
5. Evaluation already works — after CRUD lands, `tests/15` F9 can create → cart-evaluate → assert the CUSTOMER_PRICING discount end-to-end.

## Files
- new validators + 2 route files + `src/components/promotions/CustomerPricingTab.tsx` (+ row/dialog components), `permissions.ts` if new keys, `tests/15` F9 upgrade.

## Acceptance / gate
- F9 flips from "404/405" to: create rule → cart for tagged customer shows rule price; deactivate → normal price; RBAC (cashier 403) + tenant isolation tests added per module conventions.
