# Supplier create, edit and archive are audited

The audit catalogue defined `SUPPLIER_UNARCHIVED` but not create, edit or
archive, so the live audit log had zero Supplier entries apart from restores
(ARGUS #237).

## Events

| Action               | Service           | Before/after |
| -------------------- | ----------------- | ------------ |
| `SUPPLIER_CREATED`   | `createSupplier`  | after only   |
| `SUPPLIER_UPDATED`   | `updateSupplier`  | both         |
| `SUPPLIER_ARCHIVED`  | `archiveSupplier` | both         |
| `SUPPLIER_UNARCHIVED`| `unarchiveSupplier` | unchanged  |

Every row records the actor (`session.user.id` / `session.user.role`, passed by
the route) and `entityType: 'Supplier'`.

## Snapshots

`supplierAuditSnapshot()` (`src/lib/services/supplierAudit.core.ts`) copies the
editable record only: name, contact, phone, WhatsApp, email, address, lead time,
notes and `isActive`. Ids and timestamps are excluded.

The update snapshot is captured inside the same tenant-locked transaction as the
write, so before and after describe one consistent state. Archive follows the
existing restore convention: a double archive is an idempotent 200 and writes no
second row, because only the `isActive: true -> false` transition is audited.

Audit writes use the non-throwing `createAuditLog`, so a failed audit does not
roll back a successful supplier write.

## Verification

`src/lib/services/__tests__/supplierAudit.core.test.ts` covers a full snapshot,
null normalisation for optional fields and the exact snapshot key set.
