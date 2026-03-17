# Task 03.03.11 — Build Z Report Page

## Metadata

| Field          | Value                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| Task ID        | 03.03.11                                                                           |
| Name           | Build Z Report Page                                                                |
| SubPhase       | 03.03 — Returns and Exchanges                                                      |
| Status         | Not Started                                                                        |
| Complexity     | HIGH                                                                               |
| Dependencies   | SubPhase_03_01 complete (Shift and ShiftClosure models), SubPhase_03_02 complete (sales data), Task_03_03_07 complete (returns data) |
| Output Files   | src/app/dashboard/[tenantSlug]/pos/(terminal)/shift-close/page.tsx, src/app/api/shifts/[id]/z-report/route.ts, src/lib/templates/zReport.ts |

---

## Objective

Build the Z-Report (shift summary) page that appears when a cashier closes their shift. The report aggregates all sales, payments, returns, and cash movements for the shift period and presents a complete financial reconciliation. The report can be printed for physical records.

---

## Context

A Z-Report is a standard retail document. In traditional POS systems it is printed at end-of-day or end-of-shift to close out the register. In VelvetPOS the Z-Report is generated per shift and is accessible immediately after the shift is closed. It can also be reprinted at any time by navigating to a closed shift.

The report data is aggregated at report generation time from live Sales, Payments, and Returns tables — it is not pre-aggregated at ShiftClosure creation. This keeps the ShiftClosure model lean while ensuring the report always reflects the final database state.

---

## Instructions

### Step 1: Build the Z-Report Data Service Function

Create a function `buildZReportData(tenantId, shiftId)` in `src/lib/services/shift.service.ts` (add it to the existing shift service file from SubPhase_03_01). This function:

1. Fetches the Shift record (must belong to `tenantId`) with its associated `ShiftClosure` (if the shift is closed).
2. Fetches all Sales for the shift using `where: { shiftId }` with their Payment records.
3. Fetches all Returns where the Return's `createdAt` falls within the shift period (shift open time to shift close time), including ReturnLines.
4. Computes the following aggregates:

Sales aggregates:
- `totalSalesCount`: count of COMPLETED sales in the shift
- `totalSalesAmount`: sum of `Sale.totalAmount` for COMPLETED sales (decimal.js)
- `cashSalesAmount`: sum of `Payment.amount` where `Payment.method = CASH`
- `cardSalesAmount`: sum of `Payment.amount` where `Payment.method = CARD`
- `voidedSalesCount`: count of VOIDED sales in the shift
- `totalDiscountAmount`: sum of `Sale.discountAmount` for COMPLETED sales

Returns aggregates:
- `totalReturnsCount`: count of Returns in the shift period
- `totalRefundAmount`: sum of `Return.refundAmount` (decimal.js)
- `cashRefundAmount`: sum of Return.refundAmount where refundMethod = CASH
- `cardRefundAmount` : sum where refundMethod = CARD_REVERSAL
- `creditRefundAmount`: sum where refundMethod = STORE_CREDIT
- `exchangeCount`: count where refundMethod = EXCHANGE

Cash reconciliation:
- `openingFloat`: `Shift.openingFloat` (a Decimal field — add this field to the Shift model if not present; it represents the cash in the drawer at shift open)
- `expectedCashInDrawer`: openingFloat + cashSalesAmount - cashRefundAmount
- `actualCashCounted`: `ShiftClosure.closingCashCount` (add this field to ShiftClosure if not present — it is the cash amount the cashier physically counted at close)
- `cashDifference`: actualCashCounted - expectedCashInDrawer (positive = over, negative = short)

Item breakdown:
- `topProductsSold`: top 10 product variants by total quantity sold in the shift, derived from SaleLines. Each entry: productName, variantDescription, totalQtySold, totalRevenue.

Return the assembled object as `ZReportData`.

### Step 2: Build GET /api/shifts/[id]/z-report

Create `src/app/api/shifts/[id]/z-report/route.ts`.

Handler: verify session and tenant. Call `buildZReportData(tenantId, params.id)`. Return `{ success: true, data: zReportData }`.

### Step 3: Build the Z-Report Page

Create `src/app/dashboard/[tenantSlug]/pos/(terminal)/shift-close/page.tsx`.

This page receives a `shiftId` parameter (from the query string or from the POS terminal's shift state in Zustand). If the shift is still OPEN, the cashier is shown the pre-close reconciliation form (Step A). If the shift is CLOSED, the page goes directly to the Z-Report view (Step B).

Step A — Pre-Close Form (shift is OPEN):
- A "Cash Count" input: a number field where the cashier enters the total cash in the drawer. This value becomes `ShiftClosure.closingCashCount`.
- A summary of expected cash (drawn from the Z-Report API, showing expected based on sales so far — query updates every time the cashier focuses back on the page).
- A "Close Shift" button. On click: calls `POST /api/shifts/[id]/close` with `closingCashCount`. On success, transitions to Step B.

Step B — Z-Report View (shift is CLOSED):
- A "Z-Report" page header with the shift date range and a "Print Report" button.

The Z-Report renders in 6 sections:

Section 1 — Shift Summary:
A two-column grid: Shift ID (short), Cashier Name, Date Opened (DD/MM/YYYY HH:mm), Date Closed, Shift Duration (hours and minutes).

Section 2 — Sales Summary:
A summary table with rows: Total Sales Count, Total Sales Amount, Cash Sales, Card Sales, Voided Sales Count, Total Discounts Given. All amounts in JetBrains Mono.

Section 3 — Returns Summary:
A summary table: Total Returns Count, Total Refund Amount, Cash Refunds, Card Reversals, Store Credits Issued, Exchanges Completed.

Section 4 — Net Revenue:
A highlighted panel (linen background, espresso border) showing: Net Revenue = Total Sales Amount - Total Refund Amount. Large font, JetBrains Mono, espresso.

Section 5 — Cash Reconciliation:
A bordered table with colored rows:
- Opening Float — espresso label
- Cash Sales — success green
- Cash Refunds — danger red  
- Expected in Drawer — espresso bold
- Actual Counted — espresso bold
- Difference — success green if positive, danger red if negative, "Balanced" if zero

Section 6 — Top Items Sold (collapsible):
A summary table of the top 10 products sold during the shift: Product Name, Variant, Units Sold, Revenue. Collapsed by default with a "Show breakdown" toggle.

### Step 4: Build the Print Layout

Apply `@media print` styles to the Z-Report page. When printing:
- Hide the "Print Report" and "Close Shift" buttons
- Hide the navigation bar and top bar
- Remove all ShadCN card shadows
- Use Courier New monospace for all sections
- Add a footer: "Z-Report generated [timestamp] — [tenant name]"

The Print button calls `window.print()`.

---

## Expected Output

- `buildZReportData` returns complete aggregated shift data including cash reconciliation
- `GET /api/shifts/[id]/z-report` responds with the report data
- The shift-close page shows the cash count form for open shifts and the Z-Report for closed shifts
- The printed report is readable and includes all 6 sections

---

## Validation

- Opening float + cash sales - cash refunds = expected cash in drawer (mathematically correct)
- Cash difference is shown in danger red for shortfalls and success green for overages
- A shift with zero returns shows all return rows as Rs. 0.00 with no errors
- The pre-close form correctly blocks shift close if no closing cash count is entered
- Closed shifts navigate directly to the Z-Report without showing the pre-close form

---

## Notes

The Shift model may not currently have an `openingFloat` field. Add it to the Prisma schema in this task (nullable Decimal, defaults to null if the cashier skips entering an opening float). Similarly, `ShiftClosure.closingCashCount` may need to be added. Include these schema changes in the migration for this task: "run pnpm prisma migrate dev --name add_shift_float_fields". These are additive changes and do not affect existing data.
