# Payroll/staff test contracts (ARGUS #347)

The E2E suites are contracts with the current API. This change brings them back
in line with the code:

- `20_timeclock_commissions.spec.ts` T4 now resolves an ACTIVE payment account
  and sends `paymentAccountId` (required since the payout route gained the
  field). If no active account exists it expects the typed `422
  VALIDATION_ERROR` instead of a phantom `201`.
- T3 asserts `unpaid = totalEarned - totalPaid` from money fields, not the
  legacy `isPaid` flag, and checks payout history follows the selected
  commission window.
- `03_rbac_users.spec.ts` 2.2 now enforces the shared 0-100 commission ceiling
  (`100` accepted; `100.01`, `999.99`, `1000.00` rejected) instead of the old
  Decimal(5,2) 999.99 acceptance.
- 8.12 pins that staff PATCH is HR/management-only (cashier 403) and that
  `/staff` redirects a cashier.
- `commission-payout-contract.test.ts` (vitest) pins the missing-account 422
  before any write.
- Payslip contents are covered by `documents.test.ts`; partial payouts and
  backdated/returned commission math are covered by
  `commission-allocation.test.ts`, `commissionPeriod.core.test.ts` and
  `commissionClawback.core.test.ts`.
