# Recovery rate is undefined without actionable outcomes

With zero redeliveries and zero cancellations the recovery report showed `0%`,
which reads as a failed recovery programme even when no attempt had reached a
redelivery/cancel decision yet (ARGUS #517).

## Behaviour

- `computeRecoveryRate(redelivered, cancelled)` returns `null` when the
  denominator is zero; otherwise the existing one-decimal percentage.
- `RecoveryStaffRow.recoveryRate` and
  `RecoveryStatsTotals.overallRecoveryRate` are `number | null`.
- The summary card, staff table and CSV/export rows render `—` via
  `formatRecoveryRate()` for the undefined state. A genuine 0% (for example one
  cancellation and no redelivery) still renders `0%`.
- Sorting puts the undefined rate last in both directions, so "worst first"
  cannot invent a 0% row.

## Verification

`src/lib/reports/__tests__/recoveryRate.core.test.ts` and
`src/lib/services/__tests__/delivery-recovery.test.ts` cover the undefined
state, a real zero and the sort comparator.
