# Appointment conversion attribution and commission

Converted appointments were attributed to whoever clicked **Convert**, and no
commission record was created, so Appointments -> Sales/Commissions was broken
(ARGUS #132).

## Rule

`resolveAppointmentSaleOwner` (`appointmentSale.core.ts`) picks the appointment's
assigned `staffId` when set, otherwise the operator who converted.

The conversion now:

- creates the sale with `cashierId = attributed user` and resolves that user's
  open shift (shiftless if none);
- creates a commission record for the attributed user at their
  `commissionRate`, based on the sale total, non-blocking like the normal sale
  route (a commission failure never rolls back the sale);
- keeps the deposit/balance payments, ledger posting, customer spend and the
  `CONVERT_TO_SALE` audit (which records the operator as the actor) unchanged.

## Verification

`appointmentSale.core.test.ts` covers staff-first attribution, operator fallback
and blank staff ids. The conversion path is covered by `tsc` and the existing
appointment conversion tests.
