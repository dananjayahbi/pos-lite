# Purchase-order approval separation

Creating a purchase order as **SENT** commits it to the supplier, so it is an
approval action (ARGUS #224).

## Rule

| Action                                   | Permission required          |
| ---------------------------------------- | ---------------------------- |
| Create / save as `DRAFT`                 | `purchase_order:create`      |
| Create as `SENT`                         | `purchase_order:approve`     |
| `PATCH { status: 'SENT' }` on a draft    | `purchase_order:approve`     |
| Send on WhatsApp (draft -> `SENT`)       | `purchase_order:approve`     |
| Edit a draft                             | `purchase_order:approve`     |

`canCreatePurchaseOrderWithStatus()` (`src/lib/services/purchaseOrderPermissions.core.ts`)
is the shared check for the create path; the API returns **403** with a message
naming `purchase_order:approve` when a create-only role asks for `SENT`.

## UI

The new-PO, list and detail pages read the signed-in user's permissions and pass
`canApprove` to their client components:

- create-only roles see **Save as Draft** as the primary action (no "Create
  Purchase Order" button) and a note that a manager sends it;
- "Mark as Sent" is hidden for them in the list and on the draft detail page.

This matches the server rule, so the UI never offers an action the API rejects.
Manager/owner sessions keep the existing behaviour.

## Verification

`src/lib/services/__tests__/purchaseOrderPermissions.core.test.ts` covers draft
creation, the refused `SENT` case and the approver path.
