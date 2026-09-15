# M02-01 — BUG-1: leftover apparel "Gender" column header in the Inventory list

**Severity:** P3-Minor (cosmetic/mislabelling; directly contradicts client req 2.1 Ayurvedic adaptation) · **Module:** 02 Products · **QA pin:** `tests/02_inventory.spec.ts` E21 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/components/inventory/InventoryTable.tsx:200` — `<TableHead>Gender</TableHead>` still emitted between "Brand" and "Stock".
- `InventoryTable.tsx:251` — the corresponding cell renders `product._count.variants` (a count, not gender data).
- The gender *concept* is already gone from the model (`productStep1Schema` documents its removal) — only this header was missed. An Ayurvedic product list literally shows a "Gender" column.

## Fix approach
1. Rename the header to "Variants" (keep the count cell as-is — it's genuinely the variant count and useful).
2. Check the mobile/card variant of the row renderer in the same file for a mirrored label; fix both.
3. No data-model change; no API change.

## Files
- `src/components/inventory/InventoryTable.tsx` (header + any mobile duplicate).

## Acceptance / gate
- `tests/02_inventory.spec.ts` E21 flips (it asserts the header is NOT "Gender"); live DOM headers read `PRODUCT, CATEGORY, BRAND, VARIANTS, STOCK, STATUS, ACTIONS`.
- No other 02-spec assertion changes.
