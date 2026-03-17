# Task 04.02.11 — Build Cash Flow Statement

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.11 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Medium |
| Estimated Effort | 3–4 hours |
| Depends On | 04.02.10 (Expense model and page), Phase 03 Shift and Z-Report (CashMovement model) |
| Produces | Cash flow statement sub-route, cash flow API route, summary visualisation |
| Owner Role | Full-Stack Developer |

---

## Objective

Build the cash flow statement view at /dashboard/[tenantSlug]/expenses/cash-flow. This view aggregates income from sales, outflows from expenses, and cash movements from POS shifts into a single reconciled financial summary for any selected date range. Operators use this view to understand net cash position at a glance without requiring an external accounting tool.

---

## Context

Three data sources feed into the cash flow statement. First, Sale records provide total revenue — the sum of Sale.totalAmount for completed sales (excluding voided or returned-to-zero sales) in the period. Second, Expense records as built in task 04.02.10 provide cash outflows grouped by ExpenseCategory. Third, CashMovement records linked to Shifts provide opening floats, petty cash withdrawals, and manual adjustments. Together these sources yield a net figure: income minus expenses minus net cash adjustments. The CashMovement model was also used in the Phase 03 Z-Report, so the data is already being created at the terminal.

---

## Instructions

### Step 1: Create the Cash Flow API Route

Create src/app/api/expenses/cash-flow/route.ts with a GET handler. Accept dateFrom and dateTo as ISO date string query parameters. Validate both dates with Zod. Extract tenantId from the session. Execute three parallel database queries using Promise.all: query one sums Sale.totalAmount where Sale.completedAt falls in the date range and Sale.status is COMPLETED; query two fetches all Expense records in the range, grouped by category with the total amount per category; query three fetches all CashMovement records in the range, grouped by type with the total amount per type. Assemble a CashFlowResult object containing totalIncome, expensesByCategory (array of category and total), totalExpenses, cashMovementsByType, opening floats total, petty cash total, manualAdjustmentsNet, and netCashFlow computed as totalIncome minus totalExpenses minus petty cash total plus manual adjustments. Return the CashFlowResult. Restrict to MANAGER and OWNER roles.

### Step 2: Build the Cash Flow Page Shell

Create src/app/dashboard/[tenantSlug]/expenses/cash-flow/page.tsx as a server component, inheriting the same header and tab row established by the Expenses page in task 04.02.10. The "Cash Flow Statement" tab is the active tab on this page. Render a date range picker defaulting to the current calendar month and a "Generate Report" button. On first load, the statement is empty with a prompt to select a date range. After the user selects a range and clicks Generate, the client component fetches the cash flow data and renders the results.

### Step 3: Build the Summary Metrics Row

Create src/app/dashboard/[tenantSlug]/expenses/cash-flow/components/CashFlowSummary.tsx as a client component. Render three large metric cards in a horizontal row. The first card shows "Total Income" with the sum of sale totals formatted as currency, using a light green background to signal inflow. The second card shows "Total Expenses" with the sum of all expense amounts in a terracotta (#A48374) tinted background to signal outflow. The third card shows "Net Cash Flow" with the computed net, using a linen (#EBE3DB) background when positive and a terracotta-tinted background when negative. The Net Cash Flow card uses Playfair Display in a larger font size (32px) to emphasise the bottom-line figure.

### Step 4: Build the Expense Breakdown Table

Within the cash flow page, below the summary metrics row, render an "Expense Breakdown" section. Display a table with two columns: Category and Total. Render each ExpenseCategory that has at least one record, sorted by total amount descending. Include a final "Total" row summing all categories in a bold style. Add a horizontal bar chart visualisation using ShadCN Progress bars (one per category) where the bar width is proportional to that category's share of total expenses. The bars use the sand (#CBAD8D) fill colour with the mist (#D1C7BD) track colour.

### Step 5: Build the CashMovement Summary Section

Below the expense breakdown, render a "Cash Movement Summary" section. Display a compact table with columns: Movement Type, Count, and Total Amount. Show one row per CashMovementType using human-readable labels: "Opening Float" for OPENING_FLOAT, "Petty Cash Out" for PETTY_CASH_OUT, "Manual In" for MANUAL_IN, and "Manual Out" for MANUAL_OUT. MANUAL_IN amounts should appear in green and PETTY_CASH_OUT and MANUAL_OUT in terracotta to signal direction. Include a row for "Net Movement" computed as the sum of MANUAL_IN and OPENING_FLOAT minus the sum of PETTY_CASH_OUT and MANUAL_OUT.

### Step 6: Add the Income Detail Section

Above the expense breakdown, add an "Income" section that shows the total income figure alongside a breakdown by payment method. This requires joining Sale records with Payment records to group by Payment.method. Display a compact inline summary: for example, "Cash: $1,200 · Card: $3,400 · Split: $200." This breakdown helps operators verify that physical cash matches the expected cash income from card vs cash sales.

### Step 7: Handle Empty and Loading States

When the date range produces no data for any of the three sources, display a neutral empty state card with the message "No financial activity recorded for this period." When the data is loading after the user clicks Generate, show skeleton cards in the positions of the metric cards and tables. Ensure the loading state does not persist if the API call fails — show an error state with a "Try Again" button that re-triggers the query.

---

## Expected Output

- GET /api/expenses/cash-flow returns CashFlowResult aggregating sales, expenses, and cash movements
- The cash flow page renders summary metric cards, an expense breakdown table with progress bars, and a cash movement summary table
- Net cash flow is computed correctly and highlighted with directional colour cues
- The income section shows a payment-method breakdown
- Empty and error states render without layout breaks

---

## Validation

- Select a date range that spans multiple completed sales and expenses — confirm totalIncome matches the sum of Sale.totalAmount, totalExpenses matches the sum of Expense.amount, and netCashFlow equals totalIncome minus totalExpenses
- Create a CashMovement of type PETTY_CASH_OUT for 50.00 — confirm the Cash Movement Summary section shows the record and the net movement decreases by 50.00
- Select a date range with no data — confirm the empty state renders
- Verify the income payment-method breakdown totals sum to the same value as totalIncome

---

## Notes

- Sale refunds (Returns) reduce the effective income. When summing Sale.totalAmount, also subtract the total of all Return.refundAmount values where the return's updatedAt falls within the period. This produces a net income figure rather than gross, which is the more useful number for operators. Document this deduction clearly in the "Total Income" card tooltip.
- The Cash Flow Statement is a management tool, not an accounting standard report. It is intentionally simplified. If the business requires GAAP-compliant reporting, that feature would be built in a dedicated Reporting subphase and would use a purpose-built accounting data model.
