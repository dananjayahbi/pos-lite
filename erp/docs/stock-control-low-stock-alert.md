# Stock control low-stock call to action

ARGUS #188.

The dashboard rendered two competing alerts for the same variants:

1. the amber banner "N variants are at or below their low stock threshold"
   with **View Low Stock List**, and
2. a `<LowStockAlertBadge>` line "N variants low on stock" linking to the same
   page.

The banner is now the only dashboard alert. It is driven by the stock summary
the page already loads, so the count and the KPI card stay in sync. The badge
component is unchanged and remains available to the inventory list, which has
no summary banner of its own.
