# Task 01.03.08 — Build Superadmin Dashboard

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_03_02 (Super Admin layout complete), Task_01_03_07 (Tenant Service Layer complete)

## Objective

Build the Super Admin dashboard page at src/app/(superadmin)/dashboard/page.tsx that displays four key platform metrics, a recent sign-ups panel, and an upcoming renewals panel, all computed server-side from live database queries.

## Instructions

### Step 1: Create the Dashboard Page

Create the file src/app/(superadmin)/dashboard/page.tsx as an async Server Component. The page does not accept any URL parameters — all data is fetched directly on every render using current database state. Import the Prisma client and, where suitable, the tenant service functions from Step 2 onwards.

### Step 2: Fetch the Four Dashboard Metrics

At the top of the page async function, run four queries in parallel using Promise.all to minimise the total database round-trip time. The four queries are: a Prisma count on the Tenant model where status is ACTIVE and deletedAt is null (this gives Total Active Tenants); an aggregate query on the Subscription model that joins the Plan and sums the priceMonthly of all Plans attached to Subscriptions with status ACTIVE (this gives the raw MRR numeric value); a Prisma count on the Tenant model where status is GRACE_PERIOD and deletedAt is null (this gives Tenants in Grace Period); and a Prisma count on the Subscription model where nextBillingDate is greater than or equal to today and less than or equal to seven days from today and status is not CANCELLED (this gives Upcoming Renewals).

### Step 3: Compute and Format the MRR Value

The MRR aggregate query returns a Prisma aggregate result object. Extract the sum value from the result and convert it from the Prisma Decimal type to a regular number. If the sum is null (meaning zero active subscriptions exist), default to zero. Format the LKR amount using Intl.NumberFormat with the locale set to "en-LK" and the style set to "currency" with the currency code "LKR". The formatted string is what is displayed in the MRR metric card.

### Step 4: Build the Metric Cards Row

Render a four-column responsive grid of metric cards below the page heading. The page heading is an h1 in Playfair Display bold labelled "Dashboard". Use the ShadCN Card component or a custom MetricCard component at src/components/superadmin/MetricCard.tsx. Each card has a pearl background, a subtle sand border, and a layout of: a small label text in muted Inter above; a terracotta icon on the left (choose appropriate icons from lucide-react: for Active Tenants use the Store icon, for MRR use the TrendingUp icon, for Grace Period use the AlertTriangle icon, for Upcoming Renewals use the Calendar icon); and the metric value in bold Inter numerals on the right. The four cards are: Total Active Tenants showing the count, Monthly Recurring Revenue showing the formatted LKR string, Tenants in Grace Period showing the count, and Upcoming Renewals showing the count.

### Step 5: Create the MetricCard Component

Create src/components/superadmin/MetricCard.tsx as a reusable Server Component (it accepts props and renders statically, so no client directive is needed). The component props are: label (string), value (string or number), icon (a React element), and an optional trend value for future use. Apply the espresso text colour to the value numeral and the terracotta tint to the icon wrapper.

### Step 6: Fetch Recent Sign-Ups Data

Below the metrics row, query the five most recently created Tenant records that are not soft-deleted, ordered by createdAt descending. For each record, include the nested subscription with nested plan data so the plan name is available without an additional query. Store this result in a variable named recentTenants.

### Step 7: Fetch Upcoming Renewals Detail

Query the five Subscription records with the nearest upcoming nextBillingDate values where the status is ACTIVE and nextBillingDate is in the future. Include the nested Tenant and Plan data. Store this in a variable named upcomingRenewals.

### Step 8: Build the Two Detail Panels

Below the metric cards row, render two panels side by side in a two-column grid. The left panel is titled "Recent Sign-Ups" en an h2 Inter semi-bold heading. It contains a compact table or list with three columns: Store Name (linked to the tenant detail page), Plan Name, and Joined Date. Render one row per entry in recentTenants. If the list is empty, show the text "No tenants yet." The right panel is titled "Upcoming Renewals" with the same heading style. It contains a compact table with four columns: Store Name (linked to tenant detail in), Plan Name, Renewal Date, and Amount (formatted LKR from the plan's priceMonthly). Render one row per entry in upcomingRenewals. If the list is empty, show the text "No renewals in the next 7 days."

### Step 9: Wrap Data Sections in Suspense Boundaries

Wrap the metric cards grid in one Suspense boundary with a skeleton fallback showing four blank card shapes. Wrap the two-panel section in a second Suspense boundary with a skeleton showing two blank panel boxes. To enable this, extract the data-fetching parts into async sub-components: DashboardMetrics and DashboardPanels. The parent page.tsx renders these as Suspense children so the page header is visible immediately while data loads.

## Expected Output

- src/app/(superadmin)/dashboard/page.tsx renders all four metrics and two panels
- src/components/superadmin/MetricCard.tsx is a reusable card used for all four metrics
- All data is fetched server-side with parallel queries
- The MRR value is formatted as a valid LKR currency string
- Suspense boundaries ensure the page skeleton appears immediately while data loads
- Recent sign-ups and upcoming renewals panels display live database values

## Validation

- [ ] The dashboard page is accessible at /superadmin/dashboard without errors
- [ ] The Total Active Tenants metric shows the correct count from the database
- [ ] The MRR metric shows the sum of priceMonthly values for all ACTIVE subscription plans correctly formatted
- [ ] The Tenants in Grace Period metric shows the correct count
- [ ] The Upcoming Renewals metric reflects subscriptions due within 7 days
- [ ] The Recent Sign-Ups panel shows up to 5 tenants with plan names and dates
- [ ] The Upcoming Renewals panel shows up to 5 subscriptions with amounts
- [ ] Suspense skeleton cards appear momentarily before data is rendered in a dev environment with artificial latency
- [ ] pnpm tsc --noEmit passes with no errors

## Notes

The MRR computation in this task is intentionally simple: it sums the plan prices of all currently ACTIVE subscriptions. This produces an accurate MRR figure as long as every active tenant is on a standard plan with no custom pricing. If custom pricing per tenant is introduced in a later phase, the Subscription model will need its own price field or a price override mechanism, and this query will need updating to read from that field instead of the plan's default priceMonthly.
