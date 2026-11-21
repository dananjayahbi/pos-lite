# Add Cash In: explicit source paths and no future postings (ARGUS #413)

The top-up dialog offered **Outside the business / bank transfer** as one
option. Choosing it recorded a `DEPOSIT` on the petty-cash account without
debiting any bank account, so a real transfer could overstate business cash.
The Date field also accepted future dates while the fund balance was
incremented immediately.

## Source paths

`TopUpPettyCashSchema` now has an explicit `sourceType`:

| `sourceType` | Requirement | Ledger effect |
| ------------ | ----------- | ------------- |
| `EXTERNAL`   | no source account | `DEPOSIT` debit on petty cash only |
| `ACCOUNT`    | `sourceAccountId` required | `FUND_TRANSFER` pair: credit the source, debit petty cash |

Older callers that omit `sourceType` keep working: a supplied
`sourceAccountId` implies `ACCOUNT`; otherwise `EXTERNAL`.

The dialog shows two labelled choices:

- **External cash** - cash entered from outside; explicitly says no bank
  account is debited.
- **Transfer from account** - a required source account, with available
  balance validation and both ledgers updated.

The service repeats the check, so an API caller cannot mark an account
transfer as external or attach a bank account to external cash. The audit
`after` payload records `sourceType`.

## Future dates

The balance is a cached current figure, not a scheduled as-of calculation. A
future-dated top-up would therefore inflate the current balance before the
money arrived.

- The validator accepts today or a backdated entry from any timezone, but
  rejects anything more than 24 hours ahead (the same timezone-safe skew used
  by sale dates).
- The dialog date input has `max` set to local today and shows
  "Date cannot be in the future" for a typed future date.
- Because no future row can exist, the balance equation and the Cash Flow
  ledger stay aligned with the period they report.

## Verification

`src/lib/validators/__tests__/petty-cash.validators.test.ts` covers external
versus account paths, required/forbidden source accounts, inferred legacy
payloads, and future/current/backdated dates. `npx tsc --noEmit` covers the
dialog, route and service wiring.
