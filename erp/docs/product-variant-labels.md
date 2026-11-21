# Variant labels: always an explicit separator (ARGUS #150)

A variant stores its descriptor as `form` (`OIL`) and `packSize` (`100ml`). Two
surfaces rendered the SKU/product name beside those fields with only a CSS
margin, so the text read `BAI-08-OIL-100MLOIL / 100ml` (movement ledger) and
`Mahanarayan OilOIL / 500ml` (dashboard stock table).

`src/lib/products/variant-label.ts` owns the formatting:

- `formatVariantLabel({ form, packSize })` -> `OIL / 100ml`
- `appendVariantLabel(base, variant)` -> `Mahanarayan Oil · OIL / 500ml`
  (returns `base` untouched when both parts are empty)

Both renderers now pass an explicit `·` separator instead of relying on spacing,
and skip the separator when the variant has no descriptor. Surfaces updated:
`components/stock-control/StockMovementHistory.tsx` and
`app/(store)/dashboard/page.tsx`. Tests:
`src/lib/products/__tests__/variant-label.test.ts`.
