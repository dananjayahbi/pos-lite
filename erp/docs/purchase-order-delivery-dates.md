# Purchase-order delivery and due dates

ARGUS #233.

Expected delivery had no relationship to the order date, so live POs ordered
29 Oct carried deliveries of 04 Oct / 09 Oct / 17 Sep. The detail's Payment
Terms card showed "30 days / Order date 09 Nov" instead of when the money was
due, and the list had no due/overdue state.

## Delivery validation

- `purchaseOrderDeliveryDateError` (shared pure helper,
  `src/lib/services/purchaseOrderDelivery.core.ts`) is enforced by `createPO`
  and `updatePO`. The edit checks the **effective** pair, so changing only the
  delivery date or only the order date cannot leave an impossible pair.
- The API maps the message to `400 VALIDATION_ERROR`.
- Create and Edit forms set `min` to the order day, validate inline, show the
  message, and disable Save/Edit while invalid.

## Due date and ageing

`poDueDay` / `poDueState` in `src/components/purchase-order/poDates.ts`:

- due day = order day + `paymentTermDays` (`null` = immediate);
- state is `not_applicable` for drafts/cancellations, `paid` when nothing is
  outstanding, otherwise `overdue` when the due day is before today, else
  `due`.

The PO list has a new **Due** column with an Overdue badge and a Paid note; the
detail's Payment Terms card shows `Due 09 Dec 2026` (and an Overdue note) rather
than the order date. Both helpers are unit tested.
