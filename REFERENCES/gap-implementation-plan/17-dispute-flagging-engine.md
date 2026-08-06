# 17 — Dispute Flagging Engine

**Module:** M4.3 — Financial Reconciliation & Courier Payout
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [13-orderef-match-fallback](./13-orderef-match-fallback.md), [14-discrepancy-categorization](./14-discrepancy-categorization.md), [15-net-profit-calculation](./15-net-profit-calculation.md), [16-financial-accuracy-audit](./16-financial-accuracy-audit.md)

## Issue / Current State
A disputed status is defined and styled but never set by any code path. The `ReconciliationStatus` enum includes `DISPUTED`, and the reconciliation UI (`erp/src/components/delivery/reconciliation/LedgerTable.tsx`) has styling for a disputed state, but no service, API route, or workflow ever transitions a ledger entry or order to disputed. There is no dispute action, no dispute record, and no resolution workflow.

This means finance cannot formally flag an entry they believe the courier got wrong, cannot track the dispute through resolution, and cannot communicate the dispute back to the courier's account manager.

## Impact
- There is no way to formally dispute a courier charge or remittance; disagreements are handled out of band (email/phone), with no record or audit trail.
- Without a dispute record, there is no tracking of open disputes, their age, or their resolution, so disputed amounts can go unresolved indefinitely.
- The pre-existing `DISPUTED` status and UI styling are unused, leaving a partially built capability dormant.
- Financial disagreements are invisible to the audit (doc 16) and net-payout (doc 15) processes, so totals can remain inaccurate while a dispute is pending.

## Implementation Plan

### Step 1 — Model a dispute record
Add a dispute model (and any needed enums) in `erp/prisma/schema.prisma` to represent a dispute: the associated ledger entry/order, the reason, the disputed amount, the status (open, under review, accepted, rejected, closed), and timestamps. Link the dispute to the `ReconciliationLedgerEntry` so it stays connected to the reconciled record.

### Step 2 — Add a dispute service and actions
Create a dispute service that exposes the core actions: open a dispute for a ledger entry/order with a reason and disputed amount, update its status as it progresses, and close it with an outcome. Include the logic to set the linked ledger entry's `ReconciliationStatus` to `DISPUTED` when a dispute is opened and to reconcile it when the dispute resolves.

### Step 3 — Expose dispute API routes
Add API routes under the reconciliation area (`erp/src/app/api/store/reconciliation/*`) to create, list, update, and close disputes. Support scoping by tenant and by ledger entry/order, and expose open-dispute counts so the dashboard can surface workload.

### Step 4 — Surface disputes in the reconciliation UI
Update `LedgerTable.tsx` and the reconciliation dashboard to show a dispute action on eligible rows, display dispute status/badges, and list open disputes. Provide the flow to open a dispute with a reason and to move it through resolution, keeping the existing `DISPUTED` styling active and now actually used.

### Step 5 — Integrate dispute with audit and payout
Wire disputes into doc 16 (financial audit) and doc 15 (net payout) so disputed amounts are excluded or flagged in totals until resolved, and surface disputed entries in the audit report. Optionally provide a handoff view for the courier account manager to see and respond to disputes.

## Dependencies
- Requires reliable matching (doc 13) so a dispute targets a correctly attributable row.
- Relies on discrepancy categorization (doc 14) and contract-compliance audit (doc 16) to surface the rows most likely to need dispute.
- Interacts with net payout (doc 15) for amount context.
- Builds on the existing `DISPUTED` enum and UI styling already present.

## Files / Areas affected
- New dispute model + enums in `erp/prisma/schema.prisma`
- New dispute service under `erp/src/lib/services/`
- New API routes under `erp/src/app/api/store/reconciliation/*`
- `erp/src/components/delivery/reconciliation/LedgerTable.tsx` (dispute actions/status)
- Reconciliation dashboard components for open-dispute listing
