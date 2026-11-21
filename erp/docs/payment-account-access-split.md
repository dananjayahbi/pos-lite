# Payment-account access split (ARGUS #427)

`payment_account:view` existed so cashiers and stock clerks could choose a
destination account, but it also opened `/payment-accounts`: every balance, the
full tenant ledger and the cash-flow tab. The management APIs rejected their
writes, leaving controls that could only fail.

## Rule

The existing stronger key `payment_account:manage` (OWNER/MANAGER only) now
guards the management surface:

- `/payment-accounts` page;
- full account list `GET /api/store/payment-accounts`;
- single account `GET /api/store/payment-accounts/[accountId]`;
- account book `.../[accountId]/book`;
- tenant cash-flow ledger `.../cash-flow`.

`resolvePaymentAccountCapabilities` in
`src/lib/services/paymentAccountAccess.core.ts` maps the effective permission
set to page, management and movement capabilities. The page hides Add, Edit,
Fund Transfer, Deposit, Withdraw and Close when the corresponding capability is
absent, so a read-only visitor never sees a button the API will reject.

The sidebar entry now also requires `payment_account:manage`.

## Destination selection

POS and expense destination pickers use the new
`GET /api/store/payment-accounts/destinations` route, guarded by
`payment_account:view`. It returns only `id`, `name`, `type`, `status` for
ACTIVE non-petty-cash accounts - never balances or ledger rows. Server-side sale
routing (`resolveSaleAccountId`) is unchanged, so automatic POS tender routing
keeps working for cashiers.

## Verification

`paymentAccountAccess.core.test.ts` covers cashier and stock clerk (picker only,
no ledger), owner/manager (full controls) and an explicit override that grants a
movement key without leaking the ledger.

## Residual

The withdraw API still uses the `depositFunds` key because no separate withdraw
permission exists; the capability helper mirrors that guard.
