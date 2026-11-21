# Transactional staff update and audit

ARGUS #463. `updateStaff` wrote the user row and only then wrote the durable
security audits. If an audit failed, the route returned 500 but the role
change was already committed. Active-status changes had no dedicated audit
action.

## Contract

- `audit.service.writeAuditLogTx(tx, input)` writes through the transaction
  client and rethrows on failure (durable security audit semantics).
- `updateStaff` runs the user update, role audit, permission audit, status
  audit and detail audit inside one `prisma.$transaction`.
- A failed audit rolls the whole change back; no unaudited privilege or status
  change can be committed.
- `STAFF_STATUS_CHANGED` is a dedicated action with `before.isActive` /
  `after.isActive`. `isActive` was removed from the generic
  `STAFF_DETAILS_UPDATED` field list to avoid a duplicate row.
- Role and permission changes still bump `sessionVersion` in the same update,
  so live sessions are terminated as before.

## Verification

- `npx tsc --noEmit`
- existing staff validator/authorization suites
- transactional behavior is covered by the service tests that exercise
  `updateStaff` through the API; no DB migration or schema change is involved.
