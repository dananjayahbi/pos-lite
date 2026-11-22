# Payment accounts - deposit/withdraw never target petty cash

The petty-cash payment account is fund-managed: its balance is owned by the
Petty Cash service. `postLedgerEntries` rejects incidental movements on it with
a 409, but the Deposit "from" picker and the Withdraw "to" picker used to list
it, so the block only appeared after submit (ARGUS #431).

## UI

`AccountSelect` now accepts `excludePettyCash`, backed by the pure
`selectPaymentAccountOptions()` helper. Both Deposit and Withdraw set it.

- Deposit "from": active accounts, minus the target, minus petty cash.
- Withdraw "to": active accounts, minus the source, minus petty cash.
- Fund Transfer and Close Account keep petty cash available; those two flows
  opt in server-side and update the fund balance in the same transaction.

## API

`depositFunds`/`withdrawFunds` reject a petty-cash target or source before any
ledger line is posted, with a message naming the correct flow (Petty Cash ->
Add Cash In / Expense). Tenant scope and the account status check are unchanged.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/services/__tests__/paymentAccountOptions.core.test.ts`
