# Low-stock shortfall sign (ARGUS #144)

## Problem

The low-stock table rendered `-${shortfall}`, where the API already returns the
positive gap `threshold − stockQuantity`:

- stock 3 vs threshold 5 → "-2"
- stock 5 vs threshold 5 → "-0"

The CSV and JSON API were always correct (2 and 0); only the table added the
minus, which read like a negative stock requirement.

## Rule

`src/lib/inventory/lowStockShortfall.ts` (pure, unit tested):

```ts
resolveLowStockShortfall(stockQuantity, threshold)
  -> { amount: Math.max(threshold - stockQuantity, 0), label }
```

| Case | Amount | Label |
| --- | --- | --- |
| stock < threshold | positive gap | `"2 short"` |
| stock = threshold | 0 | `"At threshold"` |
| stock > threshold | 0 | `"Above threshold"` |
| zero / negative stock | positive gap | `"5 short"` / `"7 short"` |

Amounts are rounded to 2dp so decimal stock does not render floating noise, and
a gap below 0.01 renders `"At threshold"` rather than `"0 short"`. The list only
contains rows at/below threshold, so "Above threshold" is a safe fallback for
the helper rather than a displayed state.

`LowStockList` uses the helper instead of prefixing the API's positive
`shortfall` with `-`. At-threshold rows use the amber style; a real gap stays
red. The CSV/API values are untouched, and the ARGUS #213 permission, error and
loading states are unchanged.

## Other low-stock surfaces

The factory/raw-material surfaces (`RawMaterialAlertsPanel`,
`FactoryDashboardClient`, `RawMaterialTable`) show stock/threshold and a status
badge, not a shortfall number, so no wording change was needed there. The
dashboard low-stock card shows only counts.
