# Delivery detail shows the payment method and status

The Order Information card listed the COD amount but not whether the order is
`COD` or `CARD`, or `PAID`/`PENDING`, so a COD parcel waiting for cash and an
already-paid parcel looked identical (ARGUS #277).

## Behaviour

- A new **Payment** row sits directly under `COD (goods + shipping)` and reads
  e.g. `COD · Paid`, `Card · Pending`.
- `describePayment()` composes `paymentMethodLabel()` and
  `paymentStatusLabel()`; when only one half is recorded it shows that half, and
  when neither exists it shows `-`.
- `COD` stays an acronym; `CARD` renders as `Card`; unknown enum values fall
  back to a title-cased, underscore-free label.

## Verification

`src/lib/delivery/__tests__/payment.test.ts` covers COD/CARD, PAID/PENDING,
unknown values and missing halves.
