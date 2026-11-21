# Appointment conversion creates a real sale

Converting a completed appointment now goes through the same money pipeline as
a POS sale (ARGUS #119). Previously it inserted a bare `COMPLETED` CASH sale at
the service price — no line item, no tax, no payment record, no commission, no
payment-account entry, ignoring `isPaid`/`depositAmount`, and dated at conversion
time. The Z-report therefore had no cash leg for it, and cancelling the
appointment left the sale completed.

## What conversion writes

Inside one transaction:

- a **service sale line** — `SaleLine.variantId` is now nullable, so a service
  line carries the appointment title/SKU snapshots with no stock movement;
- **tenant VAT** on the service price (`extractTenantRates`), stored on the sale
  and the line (`lineTax`);
- **payment legs** for the deposit already collected at booking and the balance
  taken on delivery (both CASH, the conversion flow's assumption);
- **payment-account entries** for the collected amount (`postSaleToAccounts`);
- **customer spend** (when the appointment has a customer) and an audit row;
- the appointment's `saleId` and `isPaid = true`.

The sale is dated at `completedAt ?? startTime` of the appointment, not at the
moment of conversion. Shift linkage still follows the acting cashier's open
shift, or is shift-less outside POS hours.

## Commission

The convert route creates the cashier's commission record from the sale total +
commission rate, exactly like `POST /api/store/sales` (non-blocking side effect).

## Related guards

- A converted appointment cannot be **cancelled** — `POST /cancel` returns
  `409 APPOINTMENT_HAS_SALE`. Void the sale through the sale flow instead.
- Service lines have no product variant, so they are excluded from the stock
  movements and the product-level sales report, and the return wizard hides
  them; the API rejects a return against one with
  `RETURN_SERVICE_LINE_NOT_RETURNABLE` (422).

## Legacy rows

Sales created by the old conversion (for example the four Rs. 2,500 sales dated
17 Sep for 4 Nov appointments) remain in place; they have no lines/payments and
must be corrected manually (void or a data fix). The code now prevents new ones.
`scripts/repair-zero-line-sales.ts` is the explicit, dry-run-by-default repair
path — see `zero-line-sales.md` (ARGUS #76).

## Verification

`src/lib/appointments/__tests__/appointmentSale.core.test.ts` covers tax,
deposit splitting/capping, zero-VAT and rounding; the appointments E2E spec
asserts the converted sale has a line item, tax identity, payment record and
that cancelling a converted appointment is a typed 409.
