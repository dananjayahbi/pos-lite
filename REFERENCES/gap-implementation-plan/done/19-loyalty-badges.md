# 19 — Loyalty & Repeat-Customer Badges

**Module:** M6 — CRM & Repeat Customer Tracking
**Severity:** Low
**Status:** Not implemented
**Related docs:** [20-repeat-buyers-tab](./20-repeat-buyers-tab.md), [21-customer-value-metrics](./21-customer-value-metrics.md)

## Issue / Current State
There is no visual indicator of customer loyalty or repeat-purchase status anywhere in the ERP. The `Customer` model (`erp/prisma/schema.prisma`) carries `totalSpend` and a `sales` relation, but no stored order-count badge and no loyalty tier concept.

The customer list page (`erp/src/app/(store)/customers/page.tsx`) and the customer search dropdown (`erp/src/components/customers/CustomerSearchDropdown.tsx`) render only the customer name and spend/tag information — no star, repeat, or tier badge appears next to names. The list query `getCustomers` in `erp/src/lib/services/customer.service.ts` does not include `_count.sales`, so even the underlying order count is not available at list-render time without an extra query. Only the detail query `getCustomerById` returns `_count.sales` (used for a "Visits" figure), and that is not exposed as a loyalty badge.

## Impact
Repeat customers are the highest-value segment of a retail business, yet staff cannot visually identify them while serving or searching. A returning customer calling in or walking up is treated the same as a first-time visitor, which risks missing opportunities to recognize, retain, and reward loyal buyers. The absence of a reusable badge also makes the later Repeat Buyers filter (doc 20) harder to surface intuitively.

## Implementation Plan
### Step 1 — Derive loyalty tier in the customer service
Extend the query layer so every customer fetch carries an order count. In `getCustomers` (`erp/src/lib/services/customer.service.ts`), add a `_count.sales` selection so each returned record includes `orderCount`. Define a small, shared tier-derivation helper (pure function) that maps `orderCount` to a tier (e.g., first-time = 0–1 orders, repeat = ≥2, loyal = a higher threshold). Keep the helper in a shared location so both list and detail paths use identical logic.

### Step 2 — Build a reusable loyalty badge component
Create a small presentational component (e.g., under `erp/src/components/customers/`) that takes an order count (or tier) and renders an inline badge — a Gold Star ⭐ for loyal customers and/or a Repeat 🔁 indicator for those with ≥2 orders. It should accept a size/compact prop so it works in both the full list row and the tight search dropdown. No business logic inside the component; it only renders from the count passed in.

### Step 3 — Render badges in list and search
Wire the badge component into the customer name cells on `erp/src/app/(store)/customers/page.tsx` and into `CustomerSearchDropdown.tsx`, passing the `orderCount`/tier now returned by the service. Ensure the dropdown's query and page query both populate the count so no additional per-row requests are needed.

### Step 4 — Surface tier on the detail page
Reuse the same badge on the customer detail view fed by `getCustomerById`, next to the existing "Visits" figure, so the tier is consistent across list and detail. Add a lightweight title/tooltip explaining the tier rule (e.g., "2+ orders") for staff clarity.

## Dependencies
- [20-repeat-buyers-tab](./20-repeat-buyers-tab.md) — shares the order-count derivation; implement tier helper first so doc 20 can reuse it.
- Relies on existing `Customer.sales` relation and `_count.sales` already used by `getCustomerById`.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `Customer` model (no change strictly required; order count derived via relation).
- `erp/src/lib/services/customer.service.ts` — `getCustomers`, tier helper.
- New reusable badge component under `erp/src/components/customers/`.
- `erp/src/app/(store)/customers/page.tsx` — badge in list rows.
- `erp/src/components/customers/CustomerSearchDropdown.tsx` — badge in search results.
- Customer detail view component (consumer of `getCustomerById`).
