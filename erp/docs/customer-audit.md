# Customer master-data audit trail

Only a credit adjustment wrote a Customer audit row; create, edit, delete and CSV
imports were invisible in the audit log even though 2,278 audit rows exist
(ARGUS #315).

## Behaviour

- `customer.service.ts` now writes `CUSTOMER_CREATED`, `CUSTOMER_UPDATED` and
  `CUSTOMER_DELETED` rows with the acting user (`session.user.id`/`role`), the
  entity id and a before/after snapshot.
- The CSV import route writes one `CUSTOMER_IMPORTED` row per batch with the
  actor and the imported/skipped/error counts.
- Snapshot fields: name, phones, email, address, city, gender, birthday (ISO),
  tags, notes and `isActive`. The builder lives in `customerAudit.core.ts` so the
  field set is unit tested and shared by every write path.
- Audit writes use the existing non-blocking `createAuditLog`, so an audit
  outage does not roll back the customer change.

## Verification

`customerAudit.core.test.ts` covers the snapshot fields, birthday
serialisation/absence and the inactive/delete state.
