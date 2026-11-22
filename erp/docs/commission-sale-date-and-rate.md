# Commission sale-date periods and stored-rate reversal (ARGUS #365)

## Problems

1. **Reversal rate**: a reversal must use the percentage that actually earned
   the commission. Reading the staff member's current `User.commissionRate`
   would claw back a different percentage after a later rate change.
2. **Backdated sales**: period summaries filtered `CommissionRecord.createdAt`,
   which is the time the row was inserted. A sale backdated to September but
   entered in November appeared in November instead of September.

## Rules

### Reversal rate

`CommissionRecord.commissionRate` is the rate snapshot written when the
commission was earned. `src/lib/services/commissionRate.core.ts` is pure and
unit tested:

```ts
resolveStoredCommissionRate(positiveRecords)
  -> weighted earned/base rate, or null when there is no positive basis
```

Negative adjustment rows are ignored as a basis. Mixed-rate/duplicate records
use the earned/base weighted average, so the reversal stays proportional.
`reconcileCommissionForSale` now calls this helper and never reads the user's
current rate.

### Reporting period

The effective sale date is:

```
Sale.saleDate when set, otherwise Sale.createdAt
```

This matches the existing sale/report date fallback. Commission reporting now
uses it in:

- `getCommissionSummaryForTenant` (report rows and totals);
- `getCommissionSummaryForUser` (payroll outstanding up to month-end);
- `createCommissionPayout` (which open records a selected period can pay).

`src/lib/services/commissionPeriod.core.ts` owns `effectiveSaleDate` and the
inclusive period comparison; both are unit tested, including a backdated sale
entered later and a pre-`saleDate` row.

The stored `CommissionRecord.commissionRate` and `paidAmount` are unchanged, so
already-issued payouts remain truthful. No schema or migration change is
involved.
