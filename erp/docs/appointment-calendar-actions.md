# Appointment calendar actions (ARGUS #133)

The Calendar tab had no way to start a booking, the month grid was dominated by
cancelled QA fixtures, and clicking a slot opened the form at the current time.

## New Appointment

`CalendarHeader` now renders a primary **New Appointment** button next to the
day/week/month switcher. It calls `openCreateForm()` through the page client, so
the shared `AppointmentFormDialog` opens with the currently viewed date as its
default start. The previous/next period buttons also gained `aria-label`s.

## Slot prefill

`appointmentSlotDefaults(clicked, durationMins = 30)` in
`src/lib/appointments/appointmentCalendar.core.ts` turns the clicked slot into
`{ startTime, endTime }` ISO values. `AppointmentsPageClient` passes the result
to `openCreateForm(initialData)`, so day/week slot clicks and month day clicks
now open the form at the selected instant instead of "now".

## Month view noise

`selectMonthViewAppointments()` keeps real bookings and collapses two kinds of
row into a muted `+N hidden` marker per day:

- `CANCELLED` appointments (their grey count dot no longer dominates); and
- QA/fixture rows recognised by `isFixtureAppointment()` (title or walk-in
  starting with QA/Test/F-series/Module N, or an over-long fixture title).

Status dots, the three-row preview and the `+N more` count are all derived from
the visible rows only.

## Tests

`src/lib/appointments/__tests__/appointmentCalendar.core.test.ts` covers
cancelled hiding, QA fixture collapsing, normal completed/no-show rows, and slot
prefill start/end calculations.
