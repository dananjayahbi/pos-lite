# Supplier purchase-order metrics

ARGUS #239.

The supplier table's only PO metric was `_count.purchaseOrders`, an all-status
count. Colombo's "14" was really 9 DRAFT + 4 CANCELLED + 1 RECEIVED, and no
money context appeared anywhere on the row.

`getSuppliers` now loads each row's purchase orders with their status, total and
payments, and maps them through `summarizeSupplierPurchaseOrders`
(`src/lib/services/supplierPurchaseMetrics.core.ts`):

- `total`, `draft`, `open` (SENT + PARTIALLY_RECEIVED), `received`, `cancelled`;
- `committedValue` - totals of open and received orders (drafts and
  cancellations excluded);
- `outstandingValue` - committed value minus payments already applied, floored
  at zero.

The table renders the split under the count and adds a **Committed / Due**
column. The pure summary is unit tested. Tenant scoping is unchanged: the query
still starts from `where: { tenantId }` (plus the active/archived filter).
