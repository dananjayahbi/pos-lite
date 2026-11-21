# Appointment display conventions (ARGUS #136)

Appointment screens used `en-US` month-first, 12-hour dates while the rest of
the ERP is `en-GB` day-first. The tabs were also the only page chrome, walk-in
names appeared twice, and the public booking surface listed QA catalogue rows.

## Dates and times

`src/lib/appointments/appointmentDisplay.core.ts` is now the single formatter:

- `formatAppointmentDate` → `07 Sep 2026`, or `Monday, 07 September 2026` with
  `{ weekday: true, month: 'long' }`; `{ year: false }` gives `07 Sep`.
- `formatAppointmentTime` → `14:05` (24-hour).
- `formatAppointmentTimeRange` → `09:30 - 10:00`.
- `formatAppointmentDateTime` → `07 Sep 2026, 14:05`.
- `formatAppointmentRelativeDate` → `Today, 14:30` / `Tomorrow, 14:30` /
  `07 Sep 2029, 10:00`.
- `formatAppointmentMonthYear` → `September 2026`.

The calendar header, month preview, calendar cards, list rows, detail panel,
cancellation/reminder timestamps and the form's start-time hint all use these
helpers. `formatAppointmentListDate` delegates to the relative formatter, so
list rows are day-first and 24-hour.

## Page title

`AppointmentsLayout` renders an `h1` ("Appointments") and a one-line
description above the tab strip for every appointment route.

## Walk-in names

`appointmentCustomerLabel()` returns the linked customer name first, the
walk-in name second, and `null` when the walk-in name merely repeats the
appointment title. The list then shows "Walk-in", the calendar card falls back
to "Walk-in", and the detail panel hides the duplicate name (but keeps a phone
number if one exists).

## Public booking surface

`GET /api/public/site/[tenantSlug]/appointment-services` filters the catalogue
with `isFixtureServiceName()` before applying the website's `serviceIds`
selection, so `QA …`, `Test …` and `DeleteMe` services cannot be booked by
customers.

## Tests

- `__tests__/appointmentDisplay.core.test.ts` — day-first/long/month-only dates,
  24-hour times and ranges, relative labels, invalid input, walk-in de-dupe.
- `__tests__/appointmentList.core.test.ts` — updated to assert
  `07 Sep 2029, 10:00` and no AM/PM.
