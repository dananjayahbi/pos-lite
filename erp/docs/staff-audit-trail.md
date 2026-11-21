# Staff audit trail

Staff administration writes durable `AuditLog` rows for every security- or
pay-relevant change (ARGUS #340). Before this, only `STAFF_PASSWORD_RESET`,
`STAFF_ROLE_CHANGED` and `STAFF_PERMISSION_CHANGED` existed; creating an account,
editing contact/HR details, changing salary or bank details, deactivating an
account and changing a commission rate left no trace.

## Actions

| Action | Written when | `before` / `after` |
| ------ | ------------ | ------------------ |
| `STAFF_CREATED` | A staff account is created | `after` only: email, role, isActive, commissionRate and HR profile fields |
| `STAFF_UPDATED` | Email, name, NIC, contact, address, salary, allowances, bank or statutory fields change | Only the fields whose values changed |
| `STAFF_DEACTIVATED` | `isActive` changes true -> false | `{ isActive: true }` -> `{ isActive: false }` |
| `STAFF_REACTIVATED` | `isActive` changes false -> true | `{ isActive: false }` -> `{ isActive: true }` |
| `STAFF_COMMISSION_RATE_CHANGED` | The numeric commission rate changes | Two-decimal rate before/after |
| `STAFF_ROLE_CHANGED` | The role changes | Role before/after |
| `STAFF_PERMISSION_CHANGED` | The explicit permission override list changes | Sorted permission list before/after |
| `STAFF_PASSWORD_RESET` | An owner/manager sets a password | Session-version bump marker only |

`STAFF_DETAILS_UPDATED` remains in the action registry so historical rows stay
filterable, but new edits emit `STAFF_UPDATED`.

## Snapshot rules

`src/lib/services/staffAudit.core.ts` is pure and owns the contract:

- Only allow-listed fields are copied. A full Prisma user row can be passed in;
  `passwordHash`, `sessionVersion`, tokens and permissions can never leak into
  the ledger through a profile snapshot.
- Free text is truncated to 120 characters with a `...` suffix.
- `null` and `undefined` normalise to `null`; unchanged fields are omitted.
- Prisma `Decimal` values are stored as two-decimal strings so `5`, `5.0` and
  `Decimal("5.00")` compare as unchanged.

## Actor and durability

Both `createStaffMember` and `updateStaff` receive the session actor from the
route (`{ id, role, tenantId }`). They use `writeAuditLog`, not the best-effort
`createAuditLog`: if the audit row cannot be written, the request fails with a
500 rather than reporting an unaudited staff change as successful.

## Verification

`src/lib/services/__tests__/staffAudit.core.test.ts` covers the allow-list,
secret exclusion, text bounding, null/Decimal normalisation and changed-field
selection.
