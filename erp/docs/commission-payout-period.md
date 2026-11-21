# Payout history follows the commission period (ARGUS #362)

## Problem

Payout history was filtered by `CommissionPayout.paidAt`, while the summary
table is filtered by the commission month. A September commission paid in
November therefore disappeared from the September report ("No payouts") even
though the September summary already counted the money as paid.

## Rule

The selected dates are a **commission period**, so payout history matches the
payout's own commission window:

```
payout.periodStart <= selectedEnd
AND payout.periodEnd >= selectedStart
```

That is an overlap test:

- a payout for Sep 1-30 is visible in the September view even when `paidAt` is
  in November;
- a payout spanning a month boundary is visible in both months;
- `paidAt` is still displayed, but only as payment metadata, never as the
  period filter.

`src/lib/services/commissionPeriod.core.ts` owns the pure overlap rule and is
unit tested with the September-paid-in-November case. `getCommissionPayouts`
applies the same inequalities in Prisma.

## UI

- The history card is titled **Payout History for the Selected Commission
  Period**.
- Each row shows a **Commission Window** column next to the **Paid At** column,
  so the distinction is visible.
- The empty state names the selected commission period instead of saying
  "selected window".

The receipt dialog already showed the commission window and continues to show
`paidAt` separately. No schema or migration change is involved.
