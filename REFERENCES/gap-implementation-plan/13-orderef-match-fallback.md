# 13 — OrderRef Matching Fallback

**Module:** M4.1 — Financial Reconciliation & Courier Payout
**Severity:** High
**Status:** Not implemented
**Related docs:** [12-excel-remittance-import](./12-excel-remittance-import.md), [14-discrepancy-categorization](./14-discrepancy-categorization.md), [16-financial-accuracy-audit](./16-financial-accuracy-audit.md)

## Issue / Current State
Reconciliation matching is strictly by courier waybill number. In `reconciliation.service.ts`, the matcher resolves each statement row via `prisma.reconciliationLedgerEntry.findFirst({ where: { tenantId, waybillId } })`, i.e., it only matches a statement line to an internal ledger entry when the `waybillId` matches exactly. A code comment in the service mentions an order-reference fallback, but that fallback is not implemented — there is no matching path that uses `Delivery.orderRef`.

This is a real gap because courier statements frequently carry an internal order reference, customer invoice number, or a tracking barcode rather than a waybill ID. Any statement row lacking a usable `waybillId` simply fails to match and cannot be reconciled, even though the underlying order exists.

## Impact
- Statement rows without a matching `waybillId` are left unreconciled, so the corresponding deliveries are never closed out against the courier statement.
- Unmatched rows accumulate as false discrepancies or fall through entirely, distorting reconciliation totals and reducing financial accuracy.
- Operators must manually fix or re-key entries, adding overhead and human error.
- Incomplete matching undermines downstream categorization (doc 14), audit (doc 16), and dispute (doc 17) logic that all assume every statement row is attributable to an order.

## Implementation Plan

### Step 1 — Add an order-reference lookup path
In the reconciliation service matcher, when a `waybillId` lookup returns no ledger entry, attempt a fallback match using `Delivery.orderRef`. Because order references may not be globally unique, resolve the match within the tenant scope (same `tenantId`) and guard against ambiguous matches by detecting multiple candidates and flagging them for manual review rather than silently picking one.

### Step 2 — Add an optional tracking-barcode match
Support an additional optional match column, such as a courier tracking barcode, in addition to `orderRef`. Where a statement row exposes a barcode, attempt to resolve it to an order/delivery. Keep this as a secondary fallback after `waybillId` and `orderRef` so the primary key still wins when present.

### Step 3 — Expose match provenance on the ledger entry
Record how each statement row was matched (by waybill, by order reference, by barcode, or unmatched) on the `ReconciliationLedgerEntry`. Surface this match method in the reconciliation UI and reports so operators can see exactly why a row matched, which aids trust and auditability.

### Step 4 — Handle unmatched and ambiguous rows explicitly
Ensure that rows that fail all match strategies are surfaced clearly (as unmatchable) rather than silently skipped, and route ambiguous matches to a manual-review queue. This keeps the pipeline complete and gives operators a concrete follow-up instead of hidden gaps.

## Dependencies
- Requires imported statement rows from doc 12 (which may carry an order reference or barcode column).
- Feeds doc 14 (discrepancy categorization), which classifies each matched row.
- Underpins doc 16 (financial audit), which needs every row attributable to an order to audit deductions.

## Files / Areas affected
- `erp/src/lib/services/reconciliation.service.ts` (add `orderRef` / barcode fallback matching)
- `erp/src/components/delivery/reconciliation/LedgerTable.tsx` (surface match provenance)
- `ReconciliationLedgerEntry` model (add match-method field) in `erp/prisma/schema.prisma`
- Reconciliation API routes/reporting that expose match provenance
