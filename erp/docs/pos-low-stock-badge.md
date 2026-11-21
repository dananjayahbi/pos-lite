# POS product card low-stock badge (ARGUS #73)

The **Low** badge on a product tile must agree with the variant picker.

## Rule

`productCardStockState()` (`src/components/pos/productStockState.ts`) examines
each variant against **its own** `lowStockThreshold`:

```
low variant = 0 < stockQuantity <= (lowStockThreshold ?? 5)
```

The card shows:

| State | Badge |
| --- | --- |
| total stock = 0 | **Out of Stock** (and the dimmed overlay) |
| any variant at/below its threshold | **Low** |
| otherwise | none |

Previously the card compared the *summed* stock to a hard-coded 5. A product
with a 500 ml variant at 5/5 but other well-stocked variants totalled 57, so no
badge appeared even though the variant picker flagged the 500 ml.

The accessible name now includes `, low stock on N variant(s)`; the badge title
explains the threshold rule on hover. Legacy variants without a threshold keep
the old effective default of 5.

## Verification

`src/components/pos/__tests__/productStockState.test.ts` covers the reported
5-of-5 case, above-threshold variants, multiple low variants, zero stock and the
legacy fallback.
