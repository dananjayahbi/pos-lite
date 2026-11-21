# Audit-log filter vocabulary

The Audit Log filters used a hardcoded list of 9 entity types and 16 actions.
The live ledger held 32 entity types and 62 actions, including the dominant
`User` / `LOGIN_SUCCESS`, plus Product, Appointment, Delivery, WebsiteConfig,
RawMaterial, PaymentAccount, PettyCashFund, ProductionLog, Packaging and
RateCard. Several offered actions had zero rows while the real action names
(`STOCK_ADJUST`, `CREDIT_ADJUST`, `PURCHASE_ORDER_PAID`, `ROLE_CHANGE`) were not
selectable (ARGUS #451).

## Fix

`GET /api/audit-logs/facets` (same auth/permission as the log; tenant-scoped,
or cross-tenant for SUPER_ADMIN with an optional `tenantId`) returns the distinct
`entityType` and `action` values with row counts, most frequent first.

The audit page loads those facets and passes them to the filters, which render
the real values with their counts. The previous lists remain only as a fallback
while facets load or if the request fails. The existing strict filtering in the
log API is unchanged.

No schema or data migration is needed; new actions/entities appear
automatically after they are written.
