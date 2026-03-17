# Task 04.02.05 — Build Commission Reports Page

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.05 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Medium |
| Estimated Effort | 3–4 hours |
| Depends On | 04.02.04 (commission service layer) |
| Produces | Commission reports page, commission summary API route, Mark as Paid action |
| Owner Role | Full-Stack Developer |

---

## Objective

Build the commission reports page at /dashboard/[tenantSlug]/staff/commissions. This page allows Managers and Owners to review per-staff commission breakdowns for a selected period, inspect individual commission records, and execute the Mark as Paid action to issue a CommissionPayout. It also replaces the placeholder CommissionHistory tab on the staff detail page with a functional implementation.

---

## Context

The commission service layer from task 04.02.04 provides getCommissionSummaryForTenant and createCommissionPayout. This task wraps those service functions in API routes and builds the UI layer on top. The commission reports page is accessible only to MANAGER and OWNER roles. The CommissionHistory tab on the staff detail page is accessible to all authenticated staff — a cashier can view their own commission history but cannot see other staff or trigger payouts.

---

## Instructions

### Step 1: Create the Commission Summary API Route

Create src/app/api/staff/commissions/route.ts with a GET handler. Accept periodStart and periodEnd as ISO date strings in the query parameters. Validate both dates with Zod and confirm periodStart is before periodEnd. Call getCommissionSummaryForTenant from the commission service and return the array of CommissionSummaryResult objects. Restrict to MANAGER and OWNER roles.

### Step 2: Create the Commission Payout API Route

Create src/app/api/staff/commissions/payout/route.ts with a POST handler. Accept userId, periodStart, and periodEnd in the request body. Validate with Zod. Confirm the requesting user is MANAGER or OWNER. Call createCommissionPayout from the commission service with the authorizedById set to the session user's ID. Return the created CommissionPayout record on success. Return a 400 with the CommissionError message if the service throws (e.g., "No unpaid commission records found").

### Step 3: Create the Staff Commission Detail API Route

Create src/app/api/staff/[id]/commissions/route.ts with a GET handler. Accept page and pageSize query parameters. Call getCommissionsForUser from the commission service. Enforce that the requesting user either has MANAGER/OWNER role or that their own session userId matches the [id] parameter — a cashier may only view their own records.

### Step 4: Build the Commission Reports Page Shell

Create src/app/dashboard/[tenantSlug]/staff/commissions/page.tsx as a server component. Restrict to MANAGER and OWNER using the RBAC guard. Render a page heading "Commission Reports" in Playfair Display. Include a breadcrumb trail: Dashboard → Staff → Commission Reports. Render a period date range selector in the page header area using two ShadCN DatePicker inputs labelled "From" and "To". Default the period to the current calendar month (first and last day). The date range state is managed client-side and drives the TanStack Query fetch.

### Step 5: Build the Commission Summary Table

Create src/app/dashboard/[tenantSlug]/staff/commissions/components/CommissionTable.tsx as a client component. Fetch the commission summary using the query hook, keyed by the periodStart and periodEnd values. Render a ShadCN Table with columns: Staff Name, Role (as a badge), Sales Count, Total Sales (formatted as currency), Commission Rate, Earned Commission, Paid Amount, Unpaid Amount, and Actions. The Earned Commission column sums all records for the period. The Paid and Unpaid columns derive from filtering by isPaid. Rows with a non-zero unpaid amount highlight their Unpaid cell using the terracotta (#A48374) colour at 20% opacity as background.

### Step 6: Build the Mark as Paid Action

Within CommissionTable.tsx, add a "Mark as Paid" button in the Actions column for each row that has a non-zero unpaid amount. This button is visible only when the session role is MANAGER or OWNER. Clicking the button opens a ShadCN AlertDialog that summarises the payout: "You are about to mark [unpaidCount] commission records as paid for [Staff Name] for the period [periodStart] to [periodEnd]. Total payout: [totalUnpaid]." On confirmation, call the payout API endpoint using useMutation. On success, show a toast "Commission payout recorded for [Staff Name]" and invalidate the commission summary query. On error, show a toast with the error message from the server.

### Step 7: Build the CommissionHistory Tab Component

Replace the placeholder at src/app/dashboard/[tenantSlug]/staff/[staffId]/components/CommissionHistory.tsx. Render a ShadCN Card with the heading "Commission History". Include a summary row showing Total Earned (all time), Total Paid, and Current Unpaid Balance in three highlighted metric chips styled with the sand (#CBAD8D) background. Below the summary, render a paginated table with columns: Sale Reference, Sale Date, Base Amount, Commission Rate (snapshot), Earned Amount, Type (showing "Credit" in sage green for positive and "Debit" in terracotta for negative earnedAmount values), and Status (Paid / Unpaid badge). Implement pagination controls using the page and pageSize parameters from the API.

---

## Expected Output

- GET /api/staff/commissions returns per-staff commission summaries for the requested period
- POST /api/staff/commissions/payout creates a CommissionPayout and marks records as paid
- GET /api/staff/[id]/commissions returns a paginated commission history, enforcing own-record access for Cashier role
- The commission reports page renders a summary table with a functional date range picker
- The Mark as Paid AlertDialog appears and executes the payout correctly
- The CommissionHistory tab on the staff detail page replaces the placeholder with live data

---

## Validation

- Open the commission reports page as MANAGER — confirm the summary table populates with commission totals for the current month
- Adjust the date range to a period with known sales — confirm the table updates
- Click "Mark as Paid" for a staff member with unpaid commissions — confirm the AlertDialog appears, complete the action, and verify the database shows isPaid true on all affected CommissionRecord entries and a CommissionPayout record exists
- Navigate to a cashier's staff detail page as that cashier — confirm the CommissionHistory tab is visible and shows only their own records
- Navigate to a different staff member's detail page as a cashier — confirm the API returns 403 for the commissions endpoint

---

## Notes

- The commission reports page and the CommissionHistory tab share the same API route but are distinct views — the page aggregates across all staff and the tab is per-user. Both use the same TanStack Query cache keys, allowing background refetching to stay consistent after a payout event.
- Export to CSV is mentioned in the SubPhase brief as a note only — it is not implemented in this task. Leave a clearly labelled "Export CSV" button in the UI that shows a toast "This feature is coming soon" until the export feature is added in a future task.
