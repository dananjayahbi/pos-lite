# Appointment detail completeness (ARGUS #128)

The detail sheet now shows the full commercial/cancellation context even when
no service catalogue item is attached.

## View model

`src/lib/appointments/appointmentDetail.core.ts` (`buildAppointmentDetailView`)
normalises:

- **Service** — always rendered; “No service selected” when `serviceId` is
  null. The price is always shown (it was previously hidden behind the service
  block).
- **Payment** — price, deposit, one of `Sale recorded / Paid / Deposit taken /
  Unpaid`, and the remaining balance when money is still due.
- **Linked sale** — the scalar `saleId` (or the loaded `sale` relation) is shown
  as `Sale <8-char-id>` linking to `/sales/[id]`.
- **Conversion** — `canConvertToSale` is true only for `COMPLETED` with no sale;
  the Convert button is hidden once a sale exists, and the linked sale replaces
  it.
- **Cancellation** — reason, cancelled timestamp and the staff member who
  cancelled.
- **Reminders** — total/sent/pending/failed counts, the next pending schedule
  and the last send time; “No reminders scheduled.” when empty.

The detail API already loaded `sale`, `reminders`, `cancelledBy` and the scalar
cancellation fields; no schema or payload-shape change was required.

## Tests

`src/lib/appointments/__tests__/appointmentDetail.core.test.ts` covers no
service, deposit/paid/balance, sale-recorded vs convertible, sale relation
fallback, cancellation fields, and reminder summaries (including empty).
