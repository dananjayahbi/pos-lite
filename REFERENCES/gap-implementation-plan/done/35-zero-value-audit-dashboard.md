# 35 — Owner's Daily Zero-Value Audit Dashboard

**Module:** M11 — Zero-Value Order Verification
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [33 — Zero-Value Order Reason](./33-zero-value-order-reason.md), [34 — Replacement Linkage](./34-replacement-linkage.md)

## Issue / Current State
There is no zero-value audit report. Because zero-value sales are blocked (doc 33) and no reason is recorded, there is nothing to aggregate or review. The existing reports infrastructure (`erp/src/app/api/reports/*` and the reports UI) does not include a dedicated zero-value view, and no owner-only screen surfaces free/replacement transactions.

## Impact
The owner cannot review which staff issue zero-value orders, what reasons are being selected, which previous orders replacements reference, or who the recipients are. Without this visibility, the free/replacement channel is unverifiable, errors or abuse go unnoticed until stock reconciles at a loss, and there is no operational lever to detect repeated zero-value activity by a single cashier.

## Implementation Plan
### Step 1 — Build a zero-value report API
Add a new endpoint under `erp/src/app/api/reports/` (for example `zero-value-sales`) that returns all Rs.0 orders within the last 24 hours (configurable window) for the current tenant. Each row includes the Issuer Staff (cashier), the Selected Reason, the Linked Previous Order ID (doc 34), and Recipient/Customer Details (name, phone from the sale's customer). Gate the endpoint so only the owner role (or the relevant permission) can call it, consistent with the reports permission model.

### Step 2 — Add an owner-only daily audit tab
Add a UI tab or page (reusing the existing reports/dashboard navigation) visible only to the owner role. Render the returned rows in a table with columns for Staff, Reason, Linked Previous Order ID, Recipient Details, and Sale timestamp. Provide a date/range filter and a summary count per reason. Keep the implementation consistent with existing report tables and the reports permission gating described in doc 46.

### Step 3 — Add export and flagging affordances
Allow exporting the daily view (CSV/print) for the owner's records, and surface anomalies such as high volume of `PRODUCT_REPLACEMENT` or repeated recipients, so unusual patterns are easy to spot.

### Step 4 — Reference the audit log for completeness
Optionally enrich rows from the `AuditLog` entries written at completion (docs 33/34) to include the responsible actor even where the sale linkage is incomplete, giving a fuller audit trail.

## Dependencies
- Doc 33 must persist `zeroValueReason` on completed sales, and doc 34 must persist the linked order reference — this dashboard reads those fields.
- Doc 46 defines the permission-gating approach that this owner-only endpoint should follow.

## Files / Areas affected
- `erp/src/app/api/reports/` (new zero-value endpoint)
- `erp/src/components/` (new audit tab/table component)
- Reports navigation and dashboard pages
- Depends on `Sale` model fields added in docs 33 and 34
