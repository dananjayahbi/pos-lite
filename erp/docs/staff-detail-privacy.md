# Staff directory privacy

The staff directory used to expose every staff member's NIC, address, salary,
allowances, bank account, ETF and EPF numbers to anyone holding `staff:view`.
The detail view also printed the full bank account number (ARGUS #341).

## List endpoint

`GET /api/store/staff` returns a minimal directory DTO:

```
id, email, role, isActive, fullName, contactNumber, commissionRate,
clockedInAt, createdAt
```

The database query itself uses a narrow `select` (`STAFF_LIST_SELECT`), so HR,
salary and bank columns are not read for the list. The list table only needs
these fields.

## Detail endpoint

`GET /api/store/staff/[id]` still requires `staff:view`, but the HR/payroll
block requires the stronger `staff:manage` permission:

| Caller | Identity/access fields | NIC, address, salary, allowances, bank, ETF/EPF | Bank account number |
| ------ | ---------------------- | ----------------------------------------------- | ------------------- |
| `staff:view` only | returned | `null` | masked, e.g. `****7890` |
| `staff:manage` | returned | returned | full, for the edit form |

`PATCH /api/store/staff/[id]` already requires `staff:manage`; the edit dialog
is now hidden for callers who cannot manage staff.

## UI masking

The read-only profile card formats the account number with
`maskBankAccountNumber` (last four digits only). The edit form still receives
the full number for an authorised manager, so editing bank details keeps
working.

## Verification

`src/lib/services/__tests__/staffPrivacy.core.test.ts` pins the list allow-list,
the sensitive-field gate, permission filtering and masking edge cases.
