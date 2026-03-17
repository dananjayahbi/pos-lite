# Task 05.01.08 — Build Customer Analytics Report

## Metadata

| Field        | Value                                                            |
|--------------|------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                  |
| Phase        | 05 — The Platform                                                |
| Complexity   | Complex                                                          |
| Dependencies | 05.01.02 (ReportLayout), Customer, Sale, User models exist       |

---

## Objective

Build the Customer Analytics report at `/dashboard/[tenantSlug]/reports/customers`, comprising three sections: Top Customers by spend, a New vs Returning customers stacked bar chart, and a Churn Risk table of customers inactive for 90+ days.

---

## Context

A boutique's loyal customer base is its most valuable asset. This report gives owners and managers insight into who their best customers are, whether the customer base is growing (new customers overtaking returning), and which customers are drifting away and need re-engagement. The date range filter controls the analysis window for all three sections independently, so the owner can examine holiday season patterns versus a regular month.

---

## Instructions

**Step 1: Create the page file**

Create `src/app/(dashboard)/[tenantSlug]/reports/customers/page.tsx` as a Server Component. Extract `tenantSlug`, `from`, and `to` from props. Resolve `tenantId`. Default the range to the last 30 days if absent. Run all three data queries in parallel using `Promise.all` to minimise server response time.

**Step 2: Query Top Customers data**

Use `prisma.sale.groupBy` with `by: ["customerId"]`, filtering `tenantId`, `status: "COMPLETED"`, and `createdAt` between the date range. Select `_sum: { totalAmount: true }` and `_count: { id: true }`. Filter out rows where `customerId` is null (guest sales). Order by `_sum.totalAmount` descending and `take: 50` to limit to the top 50 customers.

Fetch the matching `Customer` records using `prisma.customer.findMany` with `where: { id: { in: collectedCustomerIds } }`. Join the two datasets in JavaScript by `customerId`. Compute "Average Order Value" per customer as `totalSpend / orderCount` via `decimal.js`. Also include the `Customer.lastVisitedAt` field or derive it from the max sale date per customer if the model stores it differently.

Sort the joined array by `totalSpend` descending before rendering. Assign a rank integer (1, 2, 3, …) to each row for display.

**Step 3: Build the Top Customers table**

Render a ShadCN `Table` with the following columns:

| Column        | Description                                                            |
|---------------|------------------------------------------------------------------------|
| Rank          | Integer, bold, centred (1 = highest spender)                          |
| Name          | Customer full name, or "Guest" if null                                 |
| Phone         | Formatted phone number; masked last 4 digits for non-owner roles       |
| Total Orders  | Count of completed sales in range — integer, right-aligned             |
| Total Spend   | Sum of sale totals in `font-mono`, right-aligned                       |
| Avg Order Value | `totalSpend / orderCount` in `font-mono`, right-aligned             |
| Last Visit    | `lastVisitedAt` formatted "d MMM yyyy"                                 |

For the phone masking rule: OWNER and MANAGER roles see the full number; CASHIER and STOCK_CLERK see only the last four digits prefixed with "•••• ". Apply this check using the server session role.

**Step 4: Query New vs Returning data**

A customer is "new" in a given week if their very first ever sale (across all time, not just the date range) falls within that week. A customer is "returning" if they have a prior completed sale before the current period. Run this in two steps:

First, use `prisma.$queryRaw` to find each customer's first-ever sale date: `SELECT "customerId", MIN("createdAt") as "firstSaleAt" FROM "Sale" WHERE "tenantId" = $1 AND "customerId" IS NOT NULL AND "status" = 'COMPLETED' GROUP BY "customerId"`. Build a `Map<customerId, firstSaleAt>`.

Second, for each week in the selected date range (using `eachWeekOfInterval` from `date-fns`), iterate over the customers who made a purchase in that week (from the groupBy in Step 2) and classify them as new (their `firstSaleAt` falls within this week) or returning. Aggregate the counts per week.

**Step 5: Build the New vs Returning stacked bar chart**

Create a `NewVsReturningChart` client component. Render a `Recharts BarChart` with `layout="horizontal"` (normal orientation). Each bar group represents one week. Stack two bars: "New" customers using sand `#CBAD8D` fill, and "Returning" customers using terracotta `#A48374` fill. Set `stackId="customers"` on both `Bar` elements. The X-axis shows week start dates formatted as "d MMM". Add a `Legend` and a `Tooltip` showing new and returning counts on hover.

**Step 6: Query Churn Risk customers**

Churn Risk customers are those who have at least one completed sale in the tenant but whose most recent sale is older than 90 days from the report's "to" date. Use `prisma.$queryRaw` to find customers with `MAX("createdAt") < (to_date - 90 days)` and `MAX("createdAt") > (to_date - 365 days)` (limit to customers who purchased within the last year but not in the last 90 days, to focus on genuinely at-risk rather than one-time ancient customers).

Join with the `Customer` table to fetch name, phone, and email. Also compute `lifetimeSpend` as the sum of all `Sale.totalAmount` for each customer across all time. Sort by `lastPurchaseDate` ascending (oldest first).

**Step 7: Build the Churn Risk table**

Render a ShadCN `Table` with columns: Customer Name, Phone (subject to the same masking rule as Top Customers), Last Purchase Date, Days Since Last Visit (computed as `differenceInDays(toDate, lastPurchaseDate)` from `date-fns`), and Lifetime Spend in `font-mono`. Add a visual indicator: customers with 60–89 days since last visit get an amber badge labelled "At Risk"; customers with 90+ days get a red badge labelled "Churned".

**Step 8: Compose the page layout**

Arrange the three sections vertically with Playfair Display section headings: "Top Customers", "New vs Returning Customers" (containing the chart and a brief descriptive note), and "Churn Risk" (with amber/red counts summarised above the table as a two-stat banner).

**Step 9: Connect ReportContext**

For export, flatten the Top Customers data (50 rows) into the `setReportData` call. The New vs Returning and Churn Risk sections can be exported as separate sheets in the Excel export by defining multiple export actions in the page's export button overrides, passed to `ReportLayout` via props.

---

## Expected Output

- Customer Analytics page loads all three sections correctly.
- Top Customers table ranks customers by spend with phone masking applied based on role.
- New vs Returning chart shows stacked weekly bars for the selected date range.
- Churn Risk table shows customers with no purchase in 90+ days with correctly coloured badges.
- All monetary values use `decimal.js` formatting.

---

## Validation

- [ ] A customer who made their first ever purchase this week appears in the "New" bar, not "Returning".
- [ ] A returning customer is never double-counted in both the New and Returning stacks.
- [ ] Phone masking: CASHIER role sees "•••• 4567" not the full number.
- [ ] OWNER role sees the full phone number.
- [ ] A customer with last purchase exactly 90 days ago appears in the Churn Risk table.
- [ ] A customer with last purchase 89 days ago does NOT appear in the Churn Risk table.
- [ ] Lifetime Spend in the Churn Risk table reflects all-time spend, not just the date range.
- [ ] The stacked bar chart renders correctly even when some weeks have zero new customers.
- [ ] The page loads without error when the tenant has zero customer records.
