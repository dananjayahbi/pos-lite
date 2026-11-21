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
Filters are case-sensitive (the enums are uppercase) and surrounding whitespace
is trimmed.
