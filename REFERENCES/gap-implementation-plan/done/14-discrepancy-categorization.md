# 14 — Discrepancy Sub-Categorization

**Module:** M4.1 — Financial Reconciliation & Courier Payout
**Severity:** Medium
**Status:** Partially implemented
**Related docs:** [12-excel-remittance-import](./12-excel-remittance-import.md), [13-orderef-match-fallback](./13-orderef-match-fallback.md), [15-net-profit-calculation](./15-net-profit-calculation.md), [16-financial-accuracy-audit](./16-financial-accuracy-audit.md), [17-dispute-flagging-engine](./17-dispute-flagging-engine.md)

## Issue / Current State
Discrepancy detection exists but is coarse-grained. When the reconciliation pipeline compares a courier statement against internal records, it flags rows with a generic `PARTIAL_MATCH` or `DISCREPANCY` status accompanied by a free-text note. The system does not classify the nature of the discrepancy.

The SRS calls for sub-categorized discrepancy types so finance and operations can distinguish between an unpaid delivery, an underpaid remittance, an unauthorized deduction taken by the courier, and an over-received amount. None of these specific classifications are currently modeled — there is no discrepancy category field on `ReconciliationLedgerEntry`, and no logic assigns one.

## Impact
- A generic discrepancy flag gives finance no actionable signal about what went wrong, so every discrepancy requires manual inspection to diagnose.
- The business cannot quantify how much revenue is lost to each specific failure mode (unpaid vs. underpaid vs. unauthorized deduction), blocking prioritization and contract renegotiation.
- Unauthorized deductions and underpayments are especially hard to chase because the system does not label them distinctly for follow-up or dispute.
- Without a category, automation for dispute creation (doc 17) and audit reporting (doc 16) has nothing to key on.

## Implementation Plan

### Step 1 — Model a discrepancy category
Add a discrepancy category/type field (enum or string) to the `ReconciliationLedgerEntry` model in `erp/prisma/schema.prisma`. Define the classification set: unpaid, underpaid, unauthorized deduction, and over-received, with a default/unknown state for rows that do not fit. Include supporting fields as needed to hold the classified amount and a reason.

### Step 2 — Classify each discrepant row in the reconciliation service
In the reconciliation service logic, when a row is found to differ from expectations, compute the category based on the direction and nature of the variance: no payment received maps to unpaid; a partial remittance maps to underpaid; a deduction not present in the configured terms maps to unauthorized deduction; a surplus maps to over-received. Persist the assigned category and reason onto the ledger entry at match time.

### Step 3 — Surface the category in the reconciliation UI
Update `LedgerTable.tsx` to display the discrepancy category as a distinct, filterable column (and/or badge) so finance can group and filter rows by category. Provide a summary view of counts per category so the business can see the mix of failure modes at a glance.

### Step 4 — Drive downstream flows from the category
Expose the category through the reconciliation API so reports, the financial audit (doc 16), and the dispute engine (doc 17) can consume it. For example, unauthorized-deduction rows become prime candidates for automatic dispute creation, and unpaid/underpaid rows feed the collection report.

## Dependencies
- Depends on imported statement rows (doc 12) and reliable matching (doc 13) so every row is attributable before classification.
- Consumed by doc 15 (net profit), doc 16 (financial audit), and doc 17 (dispute engine).
- Must align with the configured contract terms used by doc 16 to recognize an "unauthorized" deduction.

## Files / Areas affected
- `ReconciliationLedgerEntry` model + new discrepancy category enum in `erp/prisma/schema.prisma`
- `erp/src/lib/services/reconciliation.service.ts` (classification logic)
- `erp/src/components/delivery/reconciliation/LedgerTable.tsx` (display/filter category)
- Reconciliation API routes / reporting for category summaries
