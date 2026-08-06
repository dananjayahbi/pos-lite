# 12 — Excel Remittance Import (.xlsx)

**Module:** M4.1 — Financial Reconciliation & Courier Payout
**Severity:** High
**Status:** Partially implemented
**Related docs:** [11-checkout-delivery-fee](./11-checkout-delivery-fee.md), [13-orderef-match-fallback](./13-orderef-match-fallback.md), [14-discrepancy-categorization](./14-discrepancy-categorization.md), [16-financial-accuracy-audit](./16-financial-accuracy-audit.md)

## Issue / Current State
Remittance-statement import already exists but is strictly CSV-only. `importRemittanceStatement()` and the CSV parser `parseRemittanceCsv()` in `erp/src/lib/services/reconciliation.service.ts` use `papaparse` to turn uploaded rows into statement rows for the matching/reconciliation pipeline. The upload endpoint `erp/src/app/api/store/reconciliation/import/route.ts` explicitly rejects any file that is not `.csv`, and the upload UI `erp/src/components/delivery/reconciliation/RemittanceUpload.tsx` restricts the file picker with `accept=".csv"`.

In practice, couriers and banks deliver remittance statements as Excel workbooks (`.xlsx`/`.xls`), not CSV. The current restriction forces a manual CSV conversion step that is error-prone (column misalignment, encoding, sheet selection) and blocks a realistic file type.

## Impact
- Operations staff must manually export/convert Excel statements to CSV before importing, a tedious and error-prone step that slows reconciliation and can corrupt column mappings.
- A common real-world input type (`.xlsx`) is rejected outright, so teams either work around it or skip importing full statements, risking unreconciled entries and lost charges.
- The business depends on complete, accurate statement ingestion for the reconciliation pipeline; any barrier here reduces financial-accuracy coverage.

## Implementation Plan

### Step 1 — Add an Excel parsing capability to the service layer
Introduce an Excel parser (e.g., `xlsx` or `exceljs`) within `reconciliation.service.ts` alongside the existing `parseRemittanceCsv()`. The new parser should read the first (or a configurable) sheet of an `.xlsx`/`.xls` workbook, convert the sheet's row/column structure into the same normalized statement-row schema that `parseRemittanceCsv()` already produces, and return the identical data shape so the downstream matching/reconciliation pipeline needs no changes.

### Step 2 — Route the upload by file type
Update `importRemittanceStatement()` so it detects the uploaded file's type and dispatches to the appropriate parser (CSV vs. Excel). Keep the two parsers behind one shared normalization contract so the matching logic that follows is file-format-agnostic.

### Step 3 — Relax the endpoint and UI restrictions
Remove the `.csv`-only rejection in `erp/src/app/api/store/reconciliation/import/route.ts` and accept `.xlsx`/`.xls` (and continue accepting `.csv`). Update `RemittanceUpload.tsx` so the file picker `accept` includes `.xlsx` and `.xls`, and adjust any client-side validation messages accordingly.

### Step 4 — Map spreadsheet columns to the statement schema
Define a clear column-mapping step for Excel sheets (e.g., waybill/order reference, COD amount, delivery charge, deductions, remitted amount). Support flexible header matching so variations across courier templates map to the same statement fields, and surface clear errors when required columns are missing so operators can correct the template rather than silently losing data.

## Dependencies
- Depends on the existing reconciliation pipeline and statement-row schema in `reconciliation.service.ts`.
- Feeds directly into docs 13 (matching fallback) and 14 (discrepancy categorization), which operate on the imported statement rows.
- Complements doc 16 (financial audit), which audits deductions on imported statements.

## Files / Areas affected
- `erp/src/lib/services/reconciliation.service.ts` (add Excel parser; extend `importRemittanceStatement`)
- `erp/src/app/api/store/reconciliation/import/route.ts` (accept `.xlsx`/`.xls`)
- `erp/src/components/delivery/reconciliation/RemittanceUpload.tsx` (accept Excel file types)
- New/updated Excel parsing module within the reconciliation service layer
