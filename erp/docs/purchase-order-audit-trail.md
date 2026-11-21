# Purchase-order lifecycle is audited

The audit catalogue already defined `PURCHASE_ORDER_CREATED`,
`PURCHASE_ORDER_UPDATED`, `PURCHASE_ORDER_CANCELLED` and `PO_STATUS_CHANGED`, but
the service only wrote `PURCHASE_ORDER_PAID`. Creates, edits, sends, cancels and
goods receipts left no trail (ARGUS #229).

## Events

| Action                                  | Service call        | Entity type      |
| --------------------------------------- | ------------------- | ---------------- |
| `PURCHASE_ORDER_CREATED`                | `createPO`          | `PurchaseOrder`  |
| `PURCHASE_ORDER_UPDATED`                | `updatePO`          | `PurchaseOrder`  |
| `PO_STATUS_CHANGED` (send DRAFT -> SENT) | `updatePOStatus`    | `PurchaseOrder`  |
| `PURCHASE_ORDER_CANCELLED`              | `cancelPO`          | `PurchaseOrder`  |
| `PO_STATUS_CHANGED` (goods receipt)     | `receivePOLines`    | `PurchaseOrder`  |

Every row carries the actor id and role passed from the route
(`session.user.id` / `session.user.role`). Create, edit, cancel and receive also
record before/after snapshots; send records the previous and new status.

## Snapshots

`purchaseOrderAuditSnapshot()` (`src/lib/services/purchaseOrderAudit.core.ts`)
flattens Prisma `Decimal` amounts to numbers and `Date` values to ISO strings so
the JSON audit columns never contain driver-specific objects. Lines are not
copied into the snapshot; the edit event records the header/financial fields and
receipt events record the line ids and quantities received.

Audit writes use the existing `createAuditLog` helper, which swallows a write
failure: the business operation must still succeed if the audit table is
unavailable.

## Verification

`src/lib/services/__tests__/purchaseOrderAudit.core.test.ts` covers Decimal-like
values, dates, optional/nil fields and unusable input.
