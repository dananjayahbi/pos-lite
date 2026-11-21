# Sales empty state names the active range (ARGUS #84)

The Sales page opens on **Today**. A ledger holding older sales therefore
showed the generic "No sales found", which looked like missing data rather than
an active date filter.

The empty state is now contextual (pure helper in
`src/components/sales/saleDisplay.ts`):

| Situation | Title | Hint |
| --- | --- | --- |
| Today, no filters | `No sales today` | Opens on today; choose This month, Last month or a custom range |
| Other range, no filters | `No sales in this date range` | Choose a wider range, or Reset |
| Status/payment filter active | `No sales match these filters` | Clear a filter or widen the range |

The empty element is a block with a title and hint, so the message is available
to screen readers instead of inheriting the table's styling.

Tests: `src/components/sales/__tests__/saleDisplay.test.ts`.
