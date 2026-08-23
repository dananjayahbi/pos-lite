# 41 — Petty Cash Audit Trail Export

**Module:** M12 — Petty Cash Management
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md), [37-petty-cash-categories](./37-petty-cash-categories.md), [38-receipt-upload](./38-receipt-upload.md), [39-petty-cash-balance-equation](./39-petty-cash-balance-equation.md)

## Issue / Current State
The expenses and cash-flow pages are view-only. The expenses module (`erp/src/app/(store)/expenses/page.tsx`) and the cash-flow API (`erp/src/app/api/store/expenses/cash-flow/route.ts`) display data in the UI but provide no PDF or Excel export for period-end accounting. There is currently no report-export utility in the codebase (`erp/package.json` contains no XLSX/PDF library, and `erp/src` has no export helper or `Content-Disposition`-based download endpoint), so a new export capability is greenfield rather than a reuse of an existing pattern.

## Impact
Without an export, period-end petty-cash accounting and reconciliation must be transcribed manually, which is slow and error-prone. The owner and accountant cannot easily produce a categorized expense report or audit trail for tax or internal review, and the balance equation (doc 39) cannot be packaged into a shareable statement.

## Implementation Plan
### Step 1 — Establish a reusable export utility
Create a shared export helper in `erp/src/lib` (e.g., `export.ts`) that produces downloadable files. Decide between CSV/Excel and PDF: start with a straightforward CSV or Excel (server-generated file with a `Content-Disposition` attachment header) and add PDF later if needed. Add the required dependency (e.g., a lightweight XLSX or PDF library) to `erp/package.json` if a rich format is chosen.

### Step 2 — Build an export service function
Add a service function (e.g., in `erp/src/lib/services/petty-cash.service.ts`) that gathers the period's petty-cash data: expenses grouped by the categories from doc 37, the balance-equation components from doc 39, and optional receipt references from doc 38. Return a structured dataset ready for serialization.

### Step 3 — Add an export API endpoint
Create an API route (e.g., under `erp/src/app/api/store/expenses/export/` or `erp/src/app/api/store/petty-cash/export/`) that accepts a date range (and optional category filter), builds the file via the service and export helper, and returns it as a download with the proper headers. Enforce the same authorization as the existing expense routes.

### Step 4 — Add export UI controls
Add an "Export" button to the expenses page (`erp/src/app/(store)/expenses/page.tsx`) and the cash-flow view. The button triggers a client-side download of the current date range/filters from the export endpoint. Optionally add the same to the standalone petty-cash UI from doc 36 so the full audit trail (fund + expenses) is exportable.

### Step 5 — Include the balance statement
In the export, include a summary section showing the petty-cash balance equation (opening allocation, total expenses, remaining balance) so the file doubles as a reconcilable period statement.

## Dependencies
- [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md) — fund context for the statement.
- [37-petty-cash-categories](./37-petty-cash-categories.md) — grouping by categories.
- [38-receipt-upload](./38-receipt-upload.md) — optional receipt references in the export.
- [39-petty-cash-balance-equation](./39-petty-cash-balance-equation.md) — balance components included in the file.
- Greenfield export utility (no existing pattern to reuse).

## Files / Areas affected
- New export helper in `erp/src/lib/` (e.g., `export.ts`) + new dependency in `erp/package.json`.
- `erp/src/lib/services/petty-cash.service.ts` — export dataset function.
- New export API route under `erp/src/app/api/store/expenses/export/` or `erp/src/app/api/store/petty-cash/export/`.
- `erp/src/app/(store)/expenses/page.tsx` — Export button.
- Standalone petty-cash UI (from doc 36) — optional export control.
