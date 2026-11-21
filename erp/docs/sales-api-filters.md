# Sales list API filter validation (ARGUS #79)

`GET /api/store/sales` accepts `status` and `paymentMethod` filters.

Before this fix:

- `status` was cast straight to the Prisma `SaleStatus` enum, so
  `?status=NOT_A_STATUS` reached the query and returned a generic HTTP 500.
- `paymentMethod` (added in #77) silently ignored an unknown value.

Now `src/lib/sales/sale-list-filters.ts` parses both against
`Object.values(SaleStatus)` / `Object.values(PaymentMethod)`:

- valid value → filter applied;
- blank/absent → no filter;
- anything else → `400 VALIDATION_ERROR` naming the parameter, e.g.
  `Invalid status "NOT_A_STATUS". Allowed values: OPEN, COMPLETED, VOIDED`.

Valid statuses (`OPEN`, `COMPLETED`, `VOIDED`) and payment methods keep working
unchanged, and the role scoping from ARGUS #78 is applied after validation.

## Pagination cap (ARGUS #80)

The route used `parsePagination`'s 200-row default while `getSales` caps `limit`
at 100. A request for `limit=9999` therefore returned 100 rows with
`meta.limit: 200` and `totalPages: 1`, so a client believed it had all 128 rows.
The route now passes `maxLimit: 100`, matching the query layer: `meta.limit`,
rows and `totalPages` describe the same reachable set (128 rows -> 2 pages).
Filters are case-sensitive (the enums are uppercase) and surrounding whitespace
is trimmed.
