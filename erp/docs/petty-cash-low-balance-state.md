# Petty cash: clearing and surfacing the low-balance state

ARGUS #414. Removing a fund's low-balance threshold left `lowBalanceAlerted`
latched: `evaluateLowBalance` returned early on a null threshold without
clearing it, so re-adding a threshold while the fund was still low suppressed
the next alert. The balance equation highlighted only `currentBalance < 0`, so
a positive balance at or below the threshold looked healthy, and the page had
no low-balance badge.

## Contract

- `evaluateLowBalance(balance, null, alerted)` returns `clear` when the fund is
  latched, so `checkFundLowBalance` resets the flag. A null threshold with no
  latched flag still returns `none`.
- `resolveLowBalanceDisplay(balance, threshold)` is the single display rule:
  `isLow` covers negatives and positives at/below the threshold, and the label
  is `Negative balance` or `Low balance`.
- `PettyCashBalanceEquation` takes `lowBalanceThreshold` and shows a badge next
  to its title; the Current Balance card shows the same badge and colours the
  amount terracotta only while low.

## Verification

- `src/lib/petty-cash/__tests__/low-balance.test.ts`
- `src/lib/services/__tests__/petty-cash-alert.test.ts` (threshold removal)
- `npx tsc --noEmit`
