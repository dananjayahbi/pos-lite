# Staff availability enforcement (ARGUS #127)

The create/update API now enforces the selected staff member's roster. The app
previously accepted any date/time, so bookings landed on Thursday/Sunday while
the only availability was Wednesday 09:00–17:00, and approved time off was
ignored.

## Rules

For a booking with a specific `staffId`:

1. the employee must have an `isAvailable` row for the appointment's local
   day-of-week;
2. the whole booking (`startTime`–`endTime`) must fit inside that window;
3. the booking must not overlap an **approved** `StaffTimeOff` row (a row with
   no start/end blocks the whole day; a partial row blocks only its window);
4. the booking must not overlap a blocked `AppointmentSlot`.

The pure helper is `src/lib/appointments/appointmentAvailability.core.ts`; the
service calls it through `assertStaffAvailability` before create and before a
schedule-affecting update.

Bookings without a staff member ("Any available staff") have no individual
roster to check and are left to the existing overlap guard.

## API response

Violations are typed **422** responses naming the reason:

- `NO_AVAILABILITY` — no available window that day
- `OUTSIDE_AVAILABILITY` — the slot starts/ends outside the window (or crosses midnight)
- `TIME_OFF` — approved leave covers the slot
- `BLOCKED_SLOT` — a blocked slot overlaps

There is no manager override: the existing app has no override concept, so the
server rejects rather than silently accepting an invalid booking.

## Updates

The roster is re-validated when the request changes `staffId`, `startTime`,
`endTime` or `durationMins`. Status/notes-only PATCHes (and the lifecycle action
routes) do not re-run the check, so legacy invalid rows can still be resolved
(cancelled/no-show/checked in) without first meeting today's roster.

## Form (advisory)

`AppointmentForm` loads the selected staff member's availability and approved
time off, shows the configured windows, and disables Save with an inline reason
when the chosen slot would be rejected. The API remains authoritative.

## Tests

`src/lib/appointments/__tests__/appointmentAvailability.core.test.ts` covers a
valid slot, no availability, disabled availability, before/after window,
cross-midnight, multiple windows, full/partial/unapproved time off, and
blocked-slot overlap.
