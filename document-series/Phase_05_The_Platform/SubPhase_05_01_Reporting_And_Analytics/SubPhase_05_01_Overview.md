# SubPhase 05.01 — Reporting and Analytics

## Metadata

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Phase         | 05 — The Platform                                  |
| SubPhase      | 05.01                                              |
| Status        | Planned                                            |
| Dependencies  | All of Phase 01–04 complete; all core models exist |

---

## Objective

SubPhase 05.01 delivers the full reporting and analytics engine for VelvetPOS. Every core business model accumulated over Phases 01–04 — sales, stock, customers, staff, expenses, commissions, and time-clock data — is now surfaced through a unified, date-range-driven reporting interface. Tenant owners and managers receive actionable insight without leaving the platform.

The subphase also introduces scheduled delivery: a daily email summary dispatched each morning at 08:00 automatically keeps owners informed of yesterday's trading figures, even when they are away from the dashboard.

---

## Scope

**In Scope**

- SavedReport model, migration, and REST endpoints for saving and loading named report configurations.
- A shared ReportLayout shell providing a consistent date-range picker, export controls, and navigation sidebar for all report pages.
- Profit and Loss report with COGS aggregation and monthly bar chart.
- Sales by Product and Sales by Staff report pages.
- Revenue Trend report with daily/weekly/monthly toggle, peak-hour analysis, and return overlay.
- Inventory Valuation report with low-stock and dead-stock filters.
- Stock Movement report with paginated movement log and type-summary.
- Customer Analytics report with top customers, new-vs-returning chart, and churn risk table.
- Staff Performance report with TimeClock hours, commission totals, and revenue comparison chart.
- Return Rate report with category breakdown, reason analysis, and most-returned products table.
- Export utilities: PDF via @react-pdf/renderer, CSV via papaparse, Excel via xlsx.
- Daily Email Summary cron job via Resend with DailySummaryLog model.

**Out of Scope**

- Custom report builder with drag-and-drop configuration (deferred to Phase 06).
- Real-time live dashboard with WebSocket or SSE (future subphase).
- Third-party BI integrations (Google Looker Studio, Power BI).
- Automated anomaly detection or AI-generated narrative summaries.
- Multi-tenant aggregated reporting (cross-tenant analytics for SaaS operator).

---

## Technical Context

All report pages live under the route group `(dashboard)/[tenantSlug]/reports/`. A `ReportLayout` client component provides the date-range picker, export dropdown, and "Save Report" button as a shared shell. Date range state is serialised into URL search params (`?from` and `?to`) so any report view can be bookmarked or shared.

Data fetching for each report page uses a combination of React Server Components for the initial server-side query and TanStack Query for client-side refetch on filter change. Aggregation-heavy queries (COGS, StockMovement summaries) use `prisma.$queryRaw` with parameterised SQL to avoid ORM limitations on complex GROUP BY expressions.

Monetary values throughout all reports are computed and formatted using `decimal.js` to prevent floating-point drift. All monetary display uses the JetBrains Mono font class `font-mono`. Chart components are Recharts; responsive containers handle all viewport sizes.

**Models touched in this subphase:**
- New: `SavedReport`, `DailySummaryLog`
- Read: `Sale`, `SaleLine`, `Return`, `ReturnLine`, `Product`, `ProductVariant`, `StockMovement`, `Expense`, `Customer`, `User`, `TimeClock`, `CommissionRecord`, `Shift`, `Tenant`

---

## Task List

| Task ID     | Task Name                             | Complexity | Dependencies                              |
|-------------|---------------------------------------|------------|-------------------------------------------|
| 05.01.01    | Create Saved Report Model             | Simple     | Phase 01 Prisma setup                     |
| 05.01.02    | Build Report Layout and Date Range Shell | Moderate | 05.01.01                                  |
| 05.01.03    | Build Profit and Loss Report          | Complex    | 05.01.02, Sale, SaleLine, Expense models  |
| 05.01.04    | Build Sales Reports                   | Moderate   | 05.01.02, Sale, SaleLine, User models     |
| 05.01.05    | Build Revenue Trend Report            | Moderate   | 05.01.02, Sale model                      |
| 05.01.06    | Build Inventory Valuation Report      | Moderate   | 05.01.02, ProductVariant model            |
| 05.01.07    | Build Stock Movement Report           | Moderate   | 05.01.02, StockMovement model             |
| 05.01.08    | Build Customer Analytics Report       | Complex    | 05.01.02, Customer, Sale models           |
| 05.01.09    | Build Staff Performance Report        | Moderate   | 05.01.02, TimeClock, CommissionRecord     |
| 05.01.10    | Build Return Rate Report              | Moderate   | 05.01.02, Return, ReturnLine models       |
| 05.01.11    | Build Report Export Utilities         | Moderate   | 05.01.02, pnpm add recharts/xlsx/pdf deps |
| 05.01.12    | Build Daily Email Summary             | Complex    | Resend, DailySummaryLog model, Shift      |

---

## Validation Criteria

- [ ] `SavedReport` and `DailySummaryLog` models migrate cleanly with `prisma migrate dev`.
- [ ] GET `/api/reports/saved` returns only records scoped to the authenticated user's tenant.
- [ ] POST `/api/reports/saved` persists the report name, type, and filter JSON.
- [ ] The `ReportLayout` date-range picker correctly updates URL search params on selection.
- [ ] Preset buttons (Today, Last 7 Days, Last 30 Days, This Month, Last Month) populate from/to params correctly.
- [ ] Profit and Loss revenue, COGS, and expense figures are consistent with raw Sale/Expense records.
- [ ] Sales by Product table sums net revenue after subtracting return values.
- [ ] Revenue Trend daily aggregation produces one row per day with no gaps in the date axis.
- [ ] Inventory Valuation stock value uses `decimal.js` multiplication (no floating-point drift).
- [ ] Stock Movement paginated table loads page 2+ without duplicating records.
- [ ] Customer Analytics "New vs Returning" chart correctly classifies first-purchase customers.
- [ ] Staff Performance report is scoped: Cashiers see only their own row.
- [ ] Return Rate pie/donut chart renders return reasons correctly; "No Reason" is bucketed separately.
- [ ] exportToPDF, exportToCSV, and exportToExcel each trigger a browser file download.
- [ ] Cron endpoint returns 401 when `CRON_SECRET` header is missing or wrong.
- [ ] Daily email is sent to the Tenant Owner's email and logged in `DailySummaryLog`.

---

## Files Created or Modified

- `prisma/schema.prisma` — add `SavedReport` and `DailySummaryLog` models
- `prisma/migrations/[timestamp]_add_saved_report_model/migration.sql` — generated by Prisma
- `prisma/migrations/[timestamp]_add_daily_summary_log/migration.sql` — generated by Prisma
- `src/app/api/reports/saved/route.ts` — GET and POST endpoints
- `src/app/api/cron/daily-summary/route.ts` — cron endpoint
- `src/app/(dashboard)/[tenantSlug]/reports/layout.tsx` — route layout
- `src/components/reports/ReportLayout.tsx` — shared shell client component
- `src/components/reports/DateRangePicker.tsx` — popover calendar component
- `src/app/(dashboard)/[tenantSlug]/reports/profit-loss/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/sales-by-product/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/sales-by-staff/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/revenue-trend/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/inventory-valuation/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/stock-movements/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/customers/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/staff-performance/page.tsx`
- `src/app/(dashboard)/[tenantSlug]/reports/returns/page.tsx`
- `src/lib/reports/export.ts` — PDF, CSV, Excel export utilities
- `src/lib/reports/ReportContext.tsx` — context provider for report data
- `src/lib/email/dailySummary.ts` — HTML email composer
