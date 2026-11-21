# Movement History shows its source document (ARGUS #199)

`StockMovement` carries optional `saleId`, `purchaseOrderId`,
`stockTakeSessionId` and `batchId` references, but the Movement History table
and CSV ignored them, so a movement could not be tied back to the document that
produced it.

## Resolution

`src/lib/stock/movement-source.ts` (`resolveStockMovementSource`) chooses one
display source and builds its link. When more than one reference is present it
uses a deterministic priority: sale, purchase order, stock take, batch.

| Source | Table link |
| ------ | ---------- |
| Sale | `/sales/{saleId}` |
| Purchase order | `/suppliers/purchase-orders/{poId}` |
| Stock take session | `/stock-control/stock-takes/{sessionId}` |
| Batch | `/inventory/batches?variantId={variantId}` (no batch detail route exists) |

The table adds a **Source** column showing the label plus an 8-character
reference (full id in the tooltip). Manual adjustments with no reference show
a plain hyphen.

## CSV

The export appends six columns: `Source Type`, `Source ID`, `Sale ID`,
`Purchase Order ID`, `Stock Take Session ID`, `Batch ID`. `Source Type`/`Source
ID` use the same resolution, while the four specific columns preserve every
reference on the row. Appending (rather than reordering) keeps existing column
positions stable for spreadsheet consumers.

Tests: `src/lib/stock/__tests__/movement-source.test.ts`.
