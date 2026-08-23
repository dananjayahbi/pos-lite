# 15 — Net Profit Calculation Wiring

**Module:** M4.2 — Financial Reconciliation & Courier Payout
**Severity:** High
**Status:** Not implemented
**Related docs:** [11-checkout-delivery-fee](./11-checkout-delivery-fee.md), [14-discrepancy-categorization](./14-discrepancy-categorization.md), [16-financial-accuracy-audit](./16-financial-accuracy-audit.md)

## Issue / Current State
A net-payout formula already exists but is never executed. `computeNetPayout()` in `erp/src/lib/services/rate-engine.service.ts` computes net payout as gross minus the delivery fee, minus the COD commission percentage of gross, minus the VAT percentage of gross — net = gross − (fee + gross·codPct + gross·vatPct). This function is dead code: no order-creation, ledger, or reconciliation flow calls it, and no caller wires it to a `RateCard`'s `coddCommissionPct` / `vatRatePct` configuration.

Consequently, no delivered order has a computed net payout, the `ReconciliationLedgerEntry` carries no net amount, and the reconciliation UI does not show net payout figures.

## Impact
- The business cannot see per-order or per-courier net payout anywhere, so profitability per delivery channel is invisible.
- Finance cannot reconcile remitted amounts against expected net payouts, weakening the audit (doc 16) and dispute (doc 17) processes.
- A fully implemented, tested formula is being left unused, so the business loses the value of existing work.
- Manual spreadsheet math becomes the de facto tool for net profit, which is error-prone and not auditable.

## Implementation Plan

### Step 1 — Wire the formula into order/ledger flows
Invoke `computeNetPayout()` wherever a delivery is finalized, using the applicable `RateCard` configuration (`coddCommissionPct`, `vatRatePct`) and the delivery fee (see doc 11). Compute the net amount at order/delivery finalization time and store it on the `ReconciliationLedgerEntry` so the figure is persisted with the record rather than recomputed ad hoc.

### Step 2 — Store net payout on the ledger entry
Extend the `ReconciliationLedgerEntry` model in `erp/prisma/schema.prisma` with a net-payout field (and supporting gross/fee/commission fields as needed). Populate these at reconciliation-match time so each delivered order carries its expected net payout alongside the remitted amount.

### Step 3 — Surface net payout in the reconciliation UI
Update `LedgerTable.tsx` (and any summary/report components) to display expected net payout, remitted amount, and the variance between them. Provide aggregate net-payout totals so finance can see channel-level profitability.

### Step 4 — Reuse a single net-payout path
Ensure `computeNetPayout()` is the single source of truth for net payout, called from both the ERP order/delivery flow and the reconciliation flow. Avoid duplicating the formula elsewhere; any caller should use the shared service function so the calculation stays consistent and auditable.

## Dependencies
- Relies on a populated `Delivery.shippingFee` (doc 11) because the fee is part of the net calculation.
- Depends on accurate row classification (doc 14) so net-payout variances can be attributed correctly.
- Provides the expected-values basis for the financial audit (doc 16) and dispute engine (doc 17).

## Files / Areas affected
- `erp/src/lib/services/rate-engine.service.ts` (activate `computeNetPayout`)
- `ReconciliationLedgerEntry` model in `erp/prisma/schema.prisma` (net-payout fields)
- `erp/src/lib/services/reconciliation.service.ts` (call/store net payout)
- `erp/src/components/delivery/reconciliation/LedgerTable.tsx` (display net payout / variance)
