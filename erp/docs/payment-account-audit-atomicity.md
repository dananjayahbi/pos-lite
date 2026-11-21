# Payment-account audit atomicity (ARGUS #426)

Financial audit rows were written with `createAuditLog`, which uses the global
Prisma client and swallows failures. Payment-account create/transfer/deposit/
withdraw/close already ran inside `prisma.$transaction`, but the audit row was
not part of it: a rolled-back movement could leave an audit row, and a committed
movement could have no audit row at all. Account update was not transactional.

## Rule

`createAuditLogInTransaction(tx, input)` in
`src/lib/services/audit.service.ts` writes through the caller's transaction
client and **rethrows**. The movement and its audit row therefore commit or roll
back together.

Best-effort events keep using `createAuditLog`; security-critical events keep
using `writeAuditLog`. `buildAuditLogData` is shared so the payload cannot drift
between the three writers.

Covered operations:

- create account (including opening balance);
- update account (now wrapped in a transaction);
- fund transfer;
- deposit;
- withdrawal;
- close account.

`FINANCIAL_AUDIT_ACTIONS` lists the six actions so a future financial mutation
can be checked against the same set.

## Verification

`src/lib/services/__tests__/payment-account-audit.test.ts` checks the action
set, JSON-null normalisation, that the supplied transaction client receives the
write, and that a failed audit insert propagates instead of being swallowed.

## Residual

Other financial services that call `createAuditLog` inside a transaction were
not migrated in this task; they should adopt `createAuditLogInTransaction` when
their audit trail is made a commit requirement.
