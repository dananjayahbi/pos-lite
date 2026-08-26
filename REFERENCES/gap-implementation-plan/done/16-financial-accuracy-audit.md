# 16 — Financial Accuracy / Contract-Deduction Audit

**Module:** M4.2 — Financial Reconciliation & Courier Payout
**Severity:** High
**Status:** Partially implemented
**Related docs:** [11-checkout-delivery-fee](./11-checkout-delivery-fee.md), [12-excel-remittance-import](./12-excel-remittance-import.md), [13-orderef-match-fallback](./13-orderef-match-fallback.md), [14-discrepancy-categorization](./14-discrepancy-categorization.md), [15-net-profit-calculation](./15-net-profit-calculation.md), [17-dispute-flagging-engine](./17-dispute-flagging-engine.md)

## Issue / Current State
The reconciliation flow detects that a statement differs from internal records but does not verify the courier's deductions against the configured contract terms as an explicit audit. There is no check that compares the courier statement's deductions (delivery fee, COD commission percentage, VAT) against the pre-configured `RateCard` values to confirm the courier charged correctly.

While the rate engine (`erp/src/lib/services/rate-engine.service.ts`) holds the contract parameters (`RateCard` with fee, `coddCommissionPct`, `vatRatePct`), nothing in reconciliation uses those parameters to independently re-derive the expected deductions from each order and compare them to what the courier actually deducted.

## Impact
- The business cannot detect systematic over-charging by a courier (inflated delivery fee, excess COD commission, or extra VAT) because deductions are never audited against the contract.
- Unauthorized deductions are not surfaced as a distinct financial loss; they only appear as a generic discrepancy if at all.
- There is no audit report showing where courier deductions diverged from contract terms, so contract compliance is effectively unverified.
- Undetected over-charging silently erodes margin across every courier-delivered order.

## Implementation Plan

### Step 1 — Build a contract-compliance check
Add a contract-compliance audit step to the reconciliation service that, for each matched statement row, recomputes the expected deductions using the configured `RateCard` (delivery fee, COD commission percentage, VAT percentage) and compares them against the deductions the courier statement reports. Mark the row when the courier's deductions exceed, fall short of, or match the contract values.

### Step 2 — Persist the audit result on the ledger entry
Extend the `ReconciliationLedgerEntry` model in `erp/prisma/schema.prisma` to record the audit outcome (compliant / over-charged / under-charged) plus the expected vs. actual deduction figures. Feed this into the discrepancy categorization (doc 14) so an over-charge is classified as an unauthorized deduction.

### Step 3 — Generate an audit report
Add an audit-report capability (service + API route) that summarizes contract compliance across a statement or period: counts and totals of compliant rows, over-charged rows, and under-charged rows, grouped by courier/rate card. Output a report viewable in the reconciliation dashboard and exportable for finance.

### Step 4 — Surface audit findings in the UI
Update the reconciliation UI (`LedgerTable.tsx` and dashboard components) to show each row's audit status and the expected vs. actual deduction amounts, and to allow filtering to rows that failed compliance so finance can act on them.

## Dependencies
- Requires populated expected values from doc 15 (net payout) and reliable matching from doc 13.
- Depends on discrepancy categorization (doc 14) to label non-compliant deductions as unauthorized.
- Depends on the configured `RateCard` contract terms and a populated `Delivery.shippingFee` (doc 11).
- Rows flagged as over-charged feed the dispute engine (doc 17).

## Files / Areas affected
- `erp/src/lib/services/rate-engine.service.ts` (source of contract parameters)
- `erp/src/lib/services/reconciliation.service.ts` (contract-compliance audit step)
- `ReconciliationLedgerEntry` model in `erp/prisma/schema.prisma` (audit-result fields)
- New audit-report service + `erp/src/app/api/store/reconciliation/*` endpoint
- `erp/src/components/delivery/reconciliation/LedgerTable.tsx` (show audit status)
