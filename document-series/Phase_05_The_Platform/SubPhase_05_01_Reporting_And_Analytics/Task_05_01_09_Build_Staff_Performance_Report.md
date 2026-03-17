# Task 05.01.09 — Build Staff Performance Report

## Metadata

| Field        | Value                                                                         |
|--------------|-------------------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                               |
| Phase        | 05 — The Platform                                                             |
| Complexity   | Moderate                                                                      |
| Dependencies | 05.01.02 (ReportLayout), User, TimeClock, Sale, CommissionRecord models exist |

---

## Objective

Build the Staff Performance report at `/dashboard/[tenantSlug]/reports/staff-performance`, combining sales revenue, time-clock hours, and commission data per staff member, with RBAC result scoping and a revenue comparison bar chart.

---

## Context

Staff performance visibility motivates the team and surfaces discrepancies — a high-revenue cashier who clocks fewer hours versus a full-time cashier with modest sales. Because commission data is sensitive, the report enforces that Cashiers can only see their own row; Managers, Owners, and Super Admins see all staff. The date range filter allows end-of-month payroll review as well as daily check-ins.

---

## Instructions

**Step 1: Create the page file and apply RBAC scoping**

Create `src/app/(dashboard)/[tenantSlug]/reports/staff-performance/page.tsx` as a Server Component. Retrieve the server session using `getServerSession`. Extract the authenticated user's `id` and `role` from the session. Determine the `staffFilter`: if the role is `CASHIER`, set `staffFilter = { cashierId: session.user.id }`; for all other roles, leave the filter open to all staff in the tenant.

**Step 2: Query sales data per staff member**

Use `prisma.sale.groupBy` with `by: ["cashierId"]`, applying `where: { tenantId, status: "COMPLETED", createdAt: { gte: fromDate, lte: toDate }, ...staffFilter }`. Select `_sum: { totalAmount: true }` and `_count: { id: true }`. Collect all `cashierId` values for subsequent joins.

**Step 3: Query TimeClock hours per staff member**

Use `prisma.timeClock.groupBy` with `by: ["userId"]`, filtering `tenantId`, `clockOut` is not null (only completed sessions), and both `clockIn` and `clockOut` fall within the date range. Because `hoursWorked` may not be a stored column, use `prisma.$queryRaw` to compute the sum: `SELECT "userId", SUM(EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600.0) as "hoursWorked" FROM "TimeClock" WHERE "tenantId" = $1 AND "clockOut" IS NOT NULL AND "clockIn" >= $2 AND "clockOut" <= $3 GROUP BY "userId"`. This returns total hours as a decimal. Format to one decimal place in the display.

If the `staffFilter` is applied (Cashier role), include a `AND "userId" = $4` clause in the raw SQL with the Cashier's user id.

**Step 4: Query CommissionRecord data per staff member**

Use `prisma.commissionRecord.groupBy` with `by: ["userId"]`, filtering `tenantId` and `createdAt` in the date range. Select `_sum: { commissionAmount: true }` and add a second groupBy result with `where: { isPaid: true }` to produce `commissionPaid`. Compute `commissionUnpaid` as the difference.

**Step 5: Join all three datasets**

Build a unified array by starting from the sales `groupBy` result and joining TimeClock hours and commission records by `userId` / `cashierId`. Fetch `User` records for all collected ids using `prisma.user.findMany` with `where: { id: { in: allUserIds } }`, selecting `id`, `name`, and `role`. Map each row to a `StaffPerformanceRow` shape: `{ userId, name, role, salesCount, totalRevenue, avgOrderValue, hoursWorked, commissionEarned, commissionPaid }`.

For users present in TimeClock or Commission data but absent from the Sales groupBy (e.g., a staff member who clocked in but made no sales), still include them with `salesCount: 0` and `totalRevenue: 0`.

**Step 6: Build the Staff Performance table**

Render a ShadCN `Table` with the following columns:

| Column              | Description                                                         |
|---------------------|---------------------------------------------------------------------|
| Staff Name          | Full name from User record                                          |
| Role                | Role as a ShadCN `Badge` (CASHIER, MANAGER, etc.)                  |
| Hours Worked        | Decimal hours from TimeClock, formatted "X.X hrs"                  |
| Sales Count         | Count of completed sales — integer, right-aligned                   |
| Total Revenue       | Sum of `totalAmount` in `font-mono`, right-aligned                  |
| Commission Earned   | Sum of commission in `font-mono`, right-aligned                     |
| Commission Paid     | Amount already paid in muted `font-mono`, right-aligned             |

Include a totals footer row for numeric columns where summation is meaningful.

**Step 7: Build the Revenue per Staff bar chart**

Create a `StaffRevenueChart` client component. Render a `Recharts BarChart` with `layout="vertical"` so staff names appear on the Y-axis. Sort the dataset by `totalRevenue` descending for the chart. Apply terracotta `#A48374` fill. Add a `Tooltip` showing "Revenue: LKR X,XXX.XX" and the staff name. Add a `ReferenceLine` at the average revenue value (mean of all staff) with a dashed mist stroke and a small label "Avg" to provide a comparative benchmark.

**Step 8: Add role-based visibility note**

If the authenticated role is `CASHIER`, render a muted informational `Alert` component above the table stating "You are viewing your own performance data only." This makes the scoping transparent to the cashier rather than silently omitting other rows.

**Step 9: Apply manager-level access gate**

Add a server-side check: if the request originates from a `STOCK_CLERK` role, return a `redirect` to the dashboard home page with an error message, as stock clerks should not have access to commission or revenue data.

**Step 10: Connect ReportContext**

Call `setReportData` with the full staff performance array (all visible rows based on RBAC scoping). When a Cashier exports, their single row is exported. Managers and above export all rows.

---

## Expected Output

- Staff Performance page loads with all staff rows visible to OWNER/MANAGER roles.
- Cashier role sees only their own row and the "viewing own data" alert.
- STOCK_CLERK role is redirected away from this report.
- Hours Worked computed correctly from TimeClock entries.
- Commission Earned and Commission Paid columns are accurate per CommissionRecord data.
- Revenue bar chart shows the average reference line.

---

## Validation

- [ ] As CASHIER, the table contains exactly one row (the authenticated user).
- [ ] As MANAGER, all Cashiers and MANAGER-level staff are visible.
- [ ] Hours Worked for a staff member who clocked 8.5 hours yesterday shows "8.5 hrs".
- [ ] A staff member with no sales shows `salesCount = 0` and `totalRevenue = LKR 0.00`.
- [ ] Commission Paid does not exceed Commission Earned for any row.
- [ ] The reference line on the bar chart is at the mathematical mean of all visible staff revenues.
- [ ] STOCK_CLERK role is redirected and does not see any data.
- [ ] `$queryRaw` for TimeClock uses parameterised inputs.
- [ ] The page loads without errors for a date range with no time-clock entries.
