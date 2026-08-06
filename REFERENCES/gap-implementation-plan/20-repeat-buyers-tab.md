# 20 — Repeat Buyers Tab / Filter

**Module:** M6 — CRM & Repeat Customer Tracking
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [19-loyalty-badges](./19-loyalty-badges.md), [21-customer-value-metrics](./21-customer-value-metrics.md)

## Issue / Current State
The customer management page offers list filtering only by search text, tag, and spend band. The underlying list service `getCustomers` in `erp/src/lib/services/customer.service.ts` accepts `search`, `tag`, `spendMin`, `spendMax`, `page`, and `limit` — there is no order-count–based filter, so a "Repeat Buyers" view cannot be produced. There is no tab or segmented control on `erp/src/app/(store)/customers/page.tsx` to isolate customers who have purchased more than once.

A repeat-buyer audience is a core CRM segment, but it currently must be inferred manually from spend or by opening individual customer detail records (where the "Visits" count lives), which is impractical at list scale.

## Impact
The business cannot easily run campaigns, prioritize service, or report on its repeat-customer base. Without a filter/tab, staff must rely on memory or open each customer record, slowing everyday workflows and making retention initiatives — a primary driver of revenue — harder to execute and measure.

## Implementation Plan
### Step 1 — Extend the service query with an order-count filter
Add an option (e.g., `repeatBuyers?: boolean` or a `minOrders` integer) to `getCustomers` in `erp/src/lib/services/customer.service.ts`. When set, restrict results to customers whose related sale count meets the threshold (≥2 orders). Because Prisma filtering on `_count` differs from a simple field predicate, either use a `relation`-based filter or a separate query path (e.g., `some` on the `sales` relation with a grouped count). Reuse the order-count derivation introduced in doc 19 so the filter and the tier logic stay consistent.

### Step 2 — Add a Repeat Buyers tab/control to the list page
Add a segmented control or tab set on `erp/src/app/(store)/customers/page.tsx` with options such as All / Repeat Buyers (and optionally First-time). Selecting Repeat Buyers passes the new filter flag to the API and re-queries. Preserve the existing search, tag, and spend filters so they compose with the repeat-buyer selection.

### Step 3 — Wire the API route
Update the customers list API route consumed by the page (under `erp/src/app/api/store/customers/`) to accept and forward the new filter parameter to the service, with validation on the allowed values.

### Step 4 — Reflect the active filter in the UI state
Ensure the selected tab is part of the page's query state (URL or client state) so it survives pagination and can be deep-linked. Show the resulting count for the filtered set so staff see how large the repeat segment is.

## Dependencies
- [19-loyalty-badges](./19-loyalty-badges.md) — provides the shared order-count derivation and tier logic reused here.
- Existing list plumbing in `getCustomers` and the customers list API route.

## Files / Areas affected
- `erp/src/lib/services/customer.service.ts` — `getCustomers` filter option.
- Customers list API route under `erp/src/app/api/store/customers/` — pass-through of filter param.
- `erp/src/app/(store)/customers/page.tsx` — Repeat Buyers tab/control and query-state wiring.
- Reusable tier/order-count helper from doc 19.
