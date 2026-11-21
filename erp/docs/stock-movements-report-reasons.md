# Reports > Stock Movements reason coverage

The Reports stock-movement page kept its own 11-entry reason list and label map,
so MANUFACTURED and WEBSITE_ORDER showed raw tokens and could not be filtered
(discovered while fixing ARGUS #183).

The page now uses the shared `STOCK_MOVEMENT_REASONS` and
`stockMovementReasonLabel` from `lib/constants/stock-movement.ts` for the filter
and CSV labels. The report API rejects an unknown `movementType` with 400 instead
of passing it to Prisma.

## Verification

The shared reason suite (`stock-movement.test.ts`) covers all 13 labels and
parse/toggle helpers; `tsc` covers the page and route.
