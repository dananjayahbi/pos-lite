# Supplier phone uniqueness is keyed on the number, not its format

Suppliers accept two valid Sri Lankan mobile formats (`+94XXXXXXXXX` and
`07XXXXXXXX`) and store the operator's value verbatim. Create checked uniqueness
with a raw-string `findFirst({ phone })` and `@@unique([tenantId, phone])`
compares raw strings too, so `+94771234567` and `0771234567` could both create a
supplier for the same number (ARGUS #236).

## Rule

`supplierPhoneKey()` in `src/lib/services/supplierPhone.core.ts` maps both forms,
and any accepted separators, to the comparison key `94XXXXXXXXX`:

| Input               | Key           |
| ------------------- | ------------- |
| `+94771234567`      | `94771234567` |
| `0771234567`        | `94771234567` |
| `+94 77 123 4567`   | `94771234567` |
| `077-123-4567`      | `94771234567` |

The stored `phone` column is **not** rewritten: the operator's format stays as
typed, preserving the Module 06 display contract. Only the uniqueness check uses
the key.

## Where it applies

- `createSupplier` compares the new number against every supplier of the tenant
  (archived rows reserve their phone, as before) via
  `findSupplierPhoneClash()`.
- `updateSupplier` runs the same check when the phone actually changes,
  excluding the row being edited.
- Both run inside a transaction that takes `SELECT ... FOR UPDATE` on the tenant
  row first. That serialises concurrent creates/updates per tenant, which the
  raw `@@unique([tenantId, phone])` cannot do for two different formats.

A clash returns the same 409 messages as the old exact-match check, including
the "(an archived record uses this phone)" variant.

## Verification

`src/lib/services/__tests__/supplierPhone.core.test.ts` covers both formats,
separator stripping, already-canonical input, distinct numbers, live and
archived rows, self-exclusion on update and a same-number row in another format.
