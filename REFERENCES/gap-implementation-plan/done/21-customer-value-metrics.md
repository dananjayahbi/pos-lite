# 21 — Customer Value Metrics (Last Purchase, Preferred Categories)

**Module:** M6 — CRM & Repeat Customer Tracking
**Severity:** Medium
**Status:** Partially implemented
**Related docs:** [19-loyalty-badges](./19-loyalty-badges.md), [20-repeat-buyers-tab](./20-repeat-buyers-tab.md)

## Issue / Current State
Customer value tracking is only partially complete. Lifetime spend is stored on `Customer.totalSpend` and maintained during sales. Order frequency is available on the detail page as a "Visits" figure, derived in `getCustomerById` (`erp/src/lib/services/customer.service.ts`) from `_count.sales`.

Two important value signals are missing:
- **Last purchase date.** There is no `lastPurchaseAt` field on `Customer`, and the list/detail paths do not surface the date of the most recent completed sale.
- **Preferred product categories.** No aggregation of what a customer actually buys. The data exists transitively — `SaleLine` → `ProductVariant` → `Product.categoryId` (`erp/prisma/schema.prisma`) — but nothing aggregates categories across a customer's history.

## Impact
Lifetime spend and visit count alone are weak predictors of future value and do not support outreach. Without a last-purchase date the business cannot run re-engagement ("we miss you") campaigns or segment by recency. Without preferred categories, upselling and stocking decisions are guesswork. These are foundational inputs for CRM and repeat-sales growth.

## Implementation Plan
### Step 1 — Add last-purchase tracking
Introduce a `lastPurchaseAt` timestamp on `Customer` (nullable), maintained whenever a sale is finalized for a customer. Update the sales-finalization path so it sets `lastPurchaseAt` to the current time (and rolls `totalSpend` forward, which already happens). Backfill the field for existing customers from the most recent sale date in a one-off migration/seed script. Expose `lastPurchaseAt` in `getCustomerById` and `getCustomers` outputs.

### Step 2 — Add a preferred-categories aggregation
Add a service function (e.g., in `customer.service.ts`) that, given a `customerId` and `tenantId`, aggregates `SaleLine` records across the customer's sales, joins through `ProductVariant` to `Product.categoryId`, and returns categories ranked by quantity or line total. To keep it efficient, either run a grouped query over the customer's sales lines or compute it via the existing `SaleLine`/`ProductVariant` relations. Return a small ranked list (e.g., top 3–5 categories).

### Step 3 — Surface metrics on the detail page
Add a customer-value section to the customer detail view (consumer of `getCustomerById`) showing: lifetime spend, visit count, last purchase date, and top preferred categories. Format the last-purchase date relative to "now" (e.g., "12 days ago") for quick recency reading. Keep this a presentational component receiving pre-computed values.

### Step 4 — Optionally surface on the list
If desired, extend `getCustomers` to return `lastPurchaseAt` for the list so a "Last purchase" column or recency sort can be added to `erp/src/app/(store)/customers/page.tsx`. This is optional and should not add per-row queries — only include the field in the existing selection.

## Dependencies
- [19-loyalty-badges](./19-loyalty-badges.md) — shares the order-count derivation surfaced alongside the new metrics.
- [20-repeat-buyers-tab](./20-repeat-buyers-tab.md) — optional; the filter complements recency segmentation.
- Existing `SaleLine`, `ProductVariant`, `Product` relations in the Prisma schema.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `Customer.lastPurchaseAt` (nullable), optional backfill migration.
- `erp/src/lib/services/customer.service.ts` — `lastPurchaseAt` in outputs, preferred-categories aggregation function, sales-finalization update.
- Customer detail view component — value metrics section.
- `erp/src/app/(store)/customers/page.tsx` — optional last-purchase column/sort.
