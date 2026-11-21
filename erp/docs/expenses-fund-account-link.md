# One authoritative fund/account link (ARGUS #400)

The expense form had two independent controls: a **Payment Account** select and
a **Petty Cash Fund** select. Choosing the fund's payment account left the fund
picker at "Not linked", so the overdraw warning disappeared while the server
still treated the expense as fund-linked. Editing to "Not linked" sent no fund
field, the service fell back to the old fund, and the edit reported success.

## Rule

The **Payment Account** select is the single authoritative control:

- selecting an account with `pettyCashFundId` links that fund;
- selecting a non-fund account clears the fund;
- selecting **No account (unlinked)** clears both.

The old fund select is now a read-only status panel (`PettyCashFundPicker`)
that shows the derived fund, its live balance and the overdraw approval. It is
not a second source of truth.

## Server support

- `pettyCashFundId` accepts an explicit `null` in both create and update
  validators.
- `resolveExpenseLinkUpdate` normalizes the pair before fund/account
  resolution:
  - explicit fund `null` with no account clears both;
  - explicit account `null` with no fund clears both;
  - a concrete replacement account is kept;
  - omitted fields keep their old value.
- Unlinking a fund refunds its running balance and reverses the old `EXPENSE`
  ledger entry; the new state posts no ledger line. The expense/audit/balance
  work is part of the transactional write described in
  `expenses-transactional-writes.md`.
- Linking the fund's payment account still implies the fund server-side, so the
  API and UI agree even if a caller sends only the account.

## Verification

`src/lib/expenses/__tests__/link.test.ts` covers account-to-fund mapping,
non-fund accounts, no-account unlinking, explicit fund/account nulls,
replacement accounts and untouched fields. `npx tsc --noEmit` covers the form
and validator wiring.
