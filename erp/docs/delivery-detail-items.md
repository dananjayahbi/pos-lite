# Delivery detail item lines

ARGUS #271. A website delivery with `itemCount` 2 and COD Rs. 500 showed only
the count in Order Information. The ordered product lines already come back
from `GET /api/store/deliveries/[id]` as `delivery.lines`, so the detail now
renders them instead of making staff open the invoice.

## Display

The new Items card shows, per delivery line:

- product name snapshot
- SKU snapshot (`-` when the line has no SKU)
- quantity
- unit price
- line total

A footer shows the sum of the recorded line totals. If no lines were recorded,
the card says so instead of rendering an empty table.

The delivery line payload does not store per-line tax; tax remains the
order/sale-level value. No API or schema change was needed.

## Implementation

`src/components/delivery/deliveryLineItems.ts` contains the pure mapping and
totals helpers: `toDeliveryLineRows`, `deliveryLinesTotal` and `toLineInputs`.
Prisma Decimal values (serialized as strings) are converted to numbers, and
malformed amounts fall back to zero.

Tests: `src/components/delivery/__tests__/deliveryLineItems.test.ts`.
