# INF-04 — Decimal / JSON serialization contract

**Type:** prerequisite / cross-cutting · **Severity:** P2 · **Module:** all money surfaces · **QA refs:** BUG-57 (packaging), BUG-59-adjacent consumer pain, Module 34 "2-dp-safe" pins, Module 25 `^\d+\.\d{2}$` pins · **Depends on:** INF-02 (shared layer)

## Verified source state (2026-09-15)
Prisma `Decimal` values serialize inconsistently across the API:
- **String** serialization (Prisma's default JSON behavior for Decimal): e.g. `packaging.consumptionPerParcel` → `"0.75"` (BUG-57 — QA strict-equality `toBe(0.75)` fails; string concat hazard `"0.75" + 1 === "0.751"`).
- **`.toNumber()`** at various call sites (grep: `admin/metrics/route.ts:73`, public `products` + `products/[productId]` routes, POS components) — fine for display, unsafe for arithmetic at scale.
- **`.toFixed(2)` strings** on the rate engine (Module 25 QA pins `^\d+\.\d{2}$` and 2-dp LKR everywhere — that contract is *good* and tested).
- POS components do client-side Decimal math (`decimal.js` in `CartPanel`, `CardPaymentModal`, etc.) — they depend on receiving exact, consistently-typed values.

There is no documented rule, so each route invents one. The QA suite tolerates this by pinning per-route shapes.

## Goal
One written, enforced contract:

| Concern | Rule |
|---|---|
| Money in JSON responses | **2-dp string** (`"1890.00"`) by default — matches the strongest existing tested contract (rate cards, products bulk-update rounding) and is lossless for LKR |
| Money in request bodies | accept string-or-number, validate ≤2 decimals via shared Zod helper (`zPrice`), reject NaN/Infinity/negative-zero-shaped |
| Quantities (stock, weight) | integers-or-2dp **number** where JS-safe; document per-field |
| Never | raw Prisma Decimal objects in responses (their JSON shape is the accident we're removing) |

## Steps
1. Add `src/lib/api/serialize.ts`: `serializeMoney(decimal) → string 2dp`, `serializeMoneyOrNull`, applied in a route-level transform helper (pairs with INF-02's `withApiErrors`).
2. Grep sweep for response builders returning raw Prisma rows (products, packaging, sales, expenses, petty-cash, plans, metrics) and apply the serializer at the service boundary (services return DTOs, not Prisma objects — matches the existing `toRawMaterialItem` pattern).
3. Update affected QA pins per module doc (M23-02 flips BUG-57's assertion to `0.75` numeric-or-`"0.75"`— decide once here: **string "0.75"**, so M23 flips its pin to `toBe("0.75")`... NOTE: QA's BUG-57 expectation says numeric; resolve with the user — default to string-consistency and amend the pin, since the rate-card family already proves string-2dp works end-to-end).
4. Zod input helper `zPrice` in `src/lib/validators/shared.ts` reused by M03-05 (commission), M15-02 (promotion value), M27-07 (price max), M05 (spendMin etc. via XC-01 query coercion).

## Acceptance / gate
- Vitest on serializer + `zPrice` (edge: 999999999.99, 0, negative, 3-dp reject).
- `tests/23` P1 pin (BUG-57) flipped to the chosen contract; `tests/25` 2-dp pins still green (they already match); POS checkout split-tender reconciliation (tests/14) still exact.
