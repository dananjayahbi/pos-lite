# Appointment date filters (ARGUS #130)

`From` / `To` are local calendar days, inclusive on both ends.

## Problem

`new Date('2026-10-29')` parses as **UTC midnight**. In Sri Lanka that is 05:30
local, so a 03:00 appointment on the selected day was excluded; the old `To`
value also used `T23:59:59` without a timezone. Date-only input was therefore
wrong at both boundaries.

## Rules

`src/lib/appointments/appointmentDateFilters.core.ts`:

- date-only `YYYY-MM-DD` start → local `00:00:00.000`;
- date-only end → local `23:59:59.999`;
- full ISO timestamps (calendar callers) are preserved unchanged.

The service uses these parsers for the `startTime` filter, so direct API calls
with `?dateFrom=2026-10-29&dateTo=2026-10-29` are also interpreted as the local
day. `AppointmentFiltersSchema` now accepts a date-only string as well as an ISO
timestamp.

The list UI converts its date inputs through the same helper before sending ISO
timestamps, so the browser's local day is authoritative for the operator.

## Overdue consistency

The #126 `OVERDUE` filter still intersects its cutoff with the date range: when
`dateTo` is later than `now - 15 minutes`, the cutoff wins; when `dateTo` is
earlier, that date's local end is the upper bound. No status is written.

## Tests

`src/lib/appointments/__tests__/appointmentDateFilters.core.test.ts` asserts the
local start/end components, that a 03:00 local appointment is inside the
boundary day, that the previous day is excluded, and that full timestamps are
preserved.
