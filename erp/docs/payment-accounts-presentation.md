# Payment accounts - presentation completeness

ARGUS #433 collected five presentation gaps on `/payment-accounts`.

## Fixed

1. **Saved details are visible.** `details` (branch, SWIFT, merchant id, ...)
   now render on each account card and in the Account Book header, not only
   inside Edit.
2. **Closed accounts.** Edit stays available for metadata corrections and is
   labelled **Edit details** with a title explaining that history is not
   editable. Money-moving actions remain hidden on closed cards.
3. **Highest balance** ignores CLOSED accounts (their balance is frozen, not
   spendable).
4. **Search and status filters** are exposed in the Accounts tab and passed to
   the existing list API (`?search=&status=`), so a closed account can be found
   directly. The empty state distinguishes "no match" from "no accounts".
5. **Ledger time.** A ledger row shows the entry date plus the recorded time
   (`rec HH:mm`) in both the tenant Ledger and Account Book, so several
   same-day entries can be ordered visually. The header says "Date / recorded".

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/components/payment-accounts/__tests__/paymentAccountLabels.test.ts`
