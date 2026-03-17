# Task 05.02.11 — Build MRR Dashboard (Super Admin)

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.11 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | High |
| Depends On | 05.02.05 |
| Primary Files | src/app/api/admin/metrics/route.ts, src/app/dashboard/super-admin/metrics/page.tsx, src/components/super-admin/MetricsCharts.tsx |
| Roles Involved | SUPER_ADMIN |
| Dependencies | Recharts |

## Objective

Build the Super Admin financial metrics dashboard at /dashboard/super-admin/metrics. Expose MRR, ARR, subscriber counts, trial conversion, churn, and a Recharts PieChart revenue breakdown. Include a searchable, filterable tenant table with subscription status and last payment date.

## Instructions

### Step 1: Build the Metrics API Route

Create src/app/api/admin/metrics/route.ts as a GET handler restricted to SUPER_ADMIN. Any other role or missing session receives a 403.

Compute the following metrics using Prisma queries:

**MRR**: Use prisma.subscription.findMany to fetch all Subscription records with status ACTIVE, including their plan's monthlyPrice. Sum the monthlyPrice values in JavaScript using Array.reduce with Decimal.js addition to avoid floating-point errors. Store the result as a Decimal.

**ARR**: Multiply MRR by 12.

**activeSubscribers**: Use prisma.subscription.count with status ACTIVE.

**trialSubscribers**: Use prisma.subscription.count with status TRIAL.

**trialToPaidLast30Days**: Count Subscription records where status is ACTIVE and createdAt is within the last 30 days. This approximates the trial-to-paid conversion for new tenants who converted within the rolling 30-day window. For a precise measurement requiring historical status tracking, a future SubPhase can add a SubscriptionStatusHistory model.

**churnedLast30Days**: Count Subscription records where status is CANCELLED and cancelledAt is within the last 30 days.

**netChurnRate**: Compute as (churnedLast30Days / (activeSubscribers + churnedLast30Days)) * 100, rounded to two decimal places. Return 0 if the denominator is zero.

**revenueByPlan**: Use prisma.subscriptionPlan.findMany with a _count relation for active subscriptions. For each plan, compute monthlyCumulativeRevenue as the plan's monthlyPrice multiplied by the count of ACTIVE subscriptions on that plan.

**tenants**: Use prisma.tenant.findMany to fetch all tenants with subscriptionStatus, slug, and the most recent PAID Invoice (include invoices ordered by paidAt descending, take 1). Also include the subscription with its plan name. Map each tenant to a plain object containing id, name, slug, subscriptionStatus, planName, lastPaymentDate, and nextBillingDate.

Return the full metrics object as JSON. Convert all Decimal values to numbers using .toNumber() before JSON serialisation.

### Step 2: Install Recharts if Not Present

Check whether Recharts is already a project dependency (it may have been installed in SubPhase 04). If not, run "pnpm add recharts". Recharts requires client-side rendering and must only be imported in components marked "use client".

### Step 3: Build the Metrics Page Server Component

Create src/app/dashboard/super-admin/metrics/page.tsx as a server component. Validate the session and redirect non-SUPER_ADMIN sessions. Fetch the metrics by calling the API route or by calling the service functions directly (direct Prisma is preferred in server components). Pass the computed metrics data as props to child components.

Apply a linen (#EBE3DB) page background. Render a page heading "Business Metrics" in Playfair Display with espresso colour, and a subtitle showing the computation timestamp: "As of [formatted runAt]."

### Step 4: Build the Summary Stat Cards

Below the heading, render a responsive grid: 4 columns on desktop (lg:grid-cols-4), 2 columns on tablet (sm:grid-cols-2), 1 column on mobile. Each grid cell is a ShadCN Card component.

Define cards for the following metrics: MRR, ARR, Active Subscribers, Trials Active, Trial Conversion (last 30 days expressed as a percentage: trialToPaidLast30Days / max(trialSubscribers, 1) * 100, formatted as "X.X%"), Churned (last 30 days), Net Churn Rate, and a placeholder "MRR Growth" card displaying "— (Coming Soon)" in muted text.

Each card contains: a top border of 3px espresso colour, a metric label in Inter uppercase 11px muted text, and a metric value in Playfair Display 28px espresso. For monetary values (MRR, ARR), render in JetBrains Mono with the LKR prefix (formatted using Intl.NumberFormat with locale "en-LK" and currency "LKR"). For subscriber counts, render as plain integers. For percentage values, append the "%" symbol.

### Step 5: Build the Revenue Breakdown PieChart

Create src/components/super-admin/MetricsCharts.tsx as a client component ("use client"). Accept a revenueByPlan prop typed as an array of objects with fields planName, activeCount, and monthlyCumulativeRevenue (Number).

Import PieChart, Pie, Cell, Tooltip, Legend, and ResponsiveContainer from recharts. Define the slice colours as a record: STARTER maps to sand (#CBAD8D), GROWTH maps to terracotta (#A48374), ENTERPRISE maps to espresso (#3A2D28). Any other plan name falls back to mist (#D1C7BD).

Render a ResponsiveContainer with width 100% and height 300. Inside, render a PieChart with a Pie component: set data to the revenueByPlan array, dataKey to "monthlyCumulativeRevenue", nameKey to "planName", cx "50%", cy "50%", outerRadius 110, innerRadius 50 (donut style). Render a Cell for each slice with the relevant fill colour from the colour record. Include a Recharts Tooltip that formats the value as "LKR [value]" using the Intl.NumberFormat helper. Include a Recharts Legend positioned below the chart.

Render the MetricsCharts component from the server page component below the stat card grid. Pass the revenueByPlan array as the prop value.

### Step 6: Build the Tenant Status Table

Below the pie chart, render a section heading "All Tenants" with a search input and a status filter dropdown on the same row (flex layout, space between).

The tenant list and filtering logic lives in a client component: create src/components/super-admin/TenantMetricsTable.tsx as a client component. Accept a tenants prop as the full array. Use two pieces of useState: one for the search query string and one for the selected status filter (defaulting to "ALL").

Filter the tenants array on each render (no debounce needed for up to 1000 tenants): include a tenant if the tenant's name or slug contains the search query (case-insensitive substring match) AND the status filter is "ALL" or matches the tenant's subscriptionStatus exactly.

Render a ShadCN Table with columns: Tenant Name, Slug, Status (Badge), Current Plan, Last Payment, Next Billing, and View. The View cell contains a ShadCN Button variant="ghost" size="sm" linking to /dashboard/super-admin/tenants/[tenantId] (established in SubPhase 05.01). Status Badges follow the same colour scheme as in Task 05.02.09. Last Payment and Next Billing dates are formatted with date-fns's format as "dd MMM yyyy". If last payment is null (no invoices paid), show "—" in muted text.

### Step 7: Implement the LKR Formatter Utility

Create or extend src/lib/format.ts. Add and export a formatLKR function: it accepts a number or Decimal and returns a formatted string using new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount). This function is used on the metrics page, billing dashboard, invoices, and anywhere else LKR amounts are displayed to ensure consistent formatting.

### Step 8: Add Navigation Entry

In the Super Admin sidebar navigation component, add a "Metrics" navigation link at /dashboard/super-admin/metrics, positioned below the "Plans" link. Use the BarChart2 or TrendingUp icon from Lucide React. This link should be visible only when the session role is SUPER_ADMIN.

## Expected Output

- GET /api/admin/metrics — returns all KPI fields as a typed JSON object
- /dashboard/super-admin/metrics — page with stat cards, PieChart, and tenant table
- MetricsCharts.tsx — Recharts donut PieChart with VelvetPOS colour palette
- TenantMetricsTable.tsx — searchable and filterable client-side table
- formatLKR utility in src/lib/format.ts

## Validation

- [ ] GET /api/admin/metrics returns 403 for non-SUPER_ADMIN sessions
- [ ] MRR value equals the sum of plan.monthlyPrice for all ACTIVE subscriptions (verified against seed data)
- [ ] ARR equals MRR multiplied by 12
- [ ] Net Churn Rate returns 0 when no subscriptions have been cancelled in last 30 days
- [ ] PieChart renders three slices for STARTER, GROWTH, and ENTERPRISE with correct colours
- [ ] Tenant table shows all seeded tenants (from Task 05.02.12)
- [ ] Search input filters tenants by name case-insensitively
- [ ] Status filter "SUSPENDED" narrows the table to only SUSPENDED tenants
- [ ] LKR values on stat cards use JetBrains Mono font and correct currency formatting
- [ ] Navigation link to /metrics appears in the Super Admin sidebar

## Notes

- MRR computation using JavaScript Decimal.js addition is safer than a raw SQL SUM query because Decimal.js preserves precision beyond what PostgreSQL NUMERIC returns via Prisma's JSON serialisation. Always use Decimal.js for financial aggregation in application code.
- For future SubPhases, MRR Growth (month-over-month) can be computed by comparing the current MRR snapshot to a stored daily snapshot. Add a DailyMrrSnapshot model to the schema in Phase 06 to enable this metric retroactively.
- Client-side filtering is acceptable for the tenant list at Phase 05 scale (expected tenant count below 500). If the tenant count exceeds 1000, replace with a server-side paginated query with a debounced search parameter.
