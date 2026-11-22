# Stock adjustment reason vocabulary

ARGUS #189.

The adjustment form kept its own labels while the movement ledger used the
shared `STOCK_MOVEMENT_REASON_LABELS` map, so the same stored reason had two
names:

| stored reason | old form label | ledger label |
| --- | --- | --- |
| `STOLEN` | Stolen | Stolen or Lost |
| `DATA_ERROR` | Data Error | Data Entry Correction |
| `SALE_RETURN` | Sale Return | Customer Return |
| `PURCHASE_RECEIVED` | Purchase Received | Received from Purchase |

`MANUAL_ADJUSTMENT_REASON_LABELS` in
`src/lib/services/manualAdjustment.core.ts` now derives every manual-adjustment
label from `stockMovementReasonLabel`, and `StockAdjustmentForm` renders that
map. The Stock Control dashboard's Recent Activity badges also take their label
from the same helper (only the colour class stays dashboard-specific).

The stored enum values, the API allowlist and the audit trail are unchanged -
this is a presentation fix. A unit test pins each manual label to its ledger
label.
