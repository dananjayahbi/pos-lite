# Appointment summary cards (ARGUS #134)

The stats API already returned totals, per-status counts, no-show rate and
collected money, but the Calendar tab showed none of it and
`AppointmentSummaryCards` asked for the **UTC** day.

## Mounting

`AppointmentsPageClient` now renders `<AppointmentSummaryCards />` above the
calendar, so the Calendar tab shows:

- today's total, overdue, completed and completed-unpaid counts;
- money collected and deposits held; and
- the no-show rate.

The List tab already mounted the same component; both routes share one source.

## Currency and dates

- All money uses `formatRupee()` from `src/lib/format.ts`, i.e. `Rs. 1,250.00`.
  There is no `$`/USD formatting in the appointment UI.
- `appointmentLocalDayRange(now)` (`src/lib/appointments/appointmentStats.core.ts`)
  returns local 00:00:00.000 and 23:59:59.999 as ISO instants. The cards send
  those values to `GET /api/store/appointments/stats`, instead of the previous
  `${today}T00:00:00.000Z` UTC window that dropped the first 5.5 hours of a Sri
  Lankan day.

## Tests

`src/lib/appointments/__tests__/appointmentStats.core.test.ts` pins local
midnight/end-of-day boundaries, stability within one day, and day rollover.
