# Payment-account owner approval (ARGUS #428)

Managers held `payment_account:manage` and could create accounts with arbitrary
opening balances, move any amount between accounts, deposit/withdraw cash and
close accounts without an owner check.

## Rule

There is no maker-checker/approval state for payment accounts in the current
schema, so the strongest existing money role - OWNER (and SUPER_ADMIN) - is
required for the high-risk cases. `evaluatePaymentAccountPolicy` in
`src/lib/services/paymentAccountPolicy.ts` defines the pure rule:

- **any** non-zero opening balance on account creation;
- any single transfer, deposit, withdrawal or closing sweep at or above
  **Rs 100,000**.

Managers keep below-limit day-to-day movements and can create accounts with a
zero opening balance. Metadata updates are not gated because they do not move
money.

The API throws a 403 `FORBIDDEN` before any ledger write, so the rule is
enforced server-side rather than only hidden in the UI.

## Residual

- The threshold is a fixed constant, not a per-tenant setting.
- There is no approval queue or second-person sign-off: an owner acting alone
  is treated as approved. Adding maker-checker would need a schema change.
- Owners can bypass the limit by splitting a movement into smaller entries;
  a proper approval workflow should be added if that risk matters.
