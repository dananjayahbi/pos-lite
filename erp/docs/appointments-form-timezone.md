# Appointment form uses local time

The appointment **Start Time** control is a `datetime-local` input, which works
in the browser's wall-clock time, while appointments are stored as ISO UTC
instants. The form must convert between the two (ARGUS #118).

## Bug

The control rendered `form.startTime.slice(0, 16)` — the UTC slice of the ISO
string. In a UTC+5:30 store, typing 10:00 immediately rendered 04:30, and the
next keystroke parsed that 04:30 as local time and stored yet another shifted
instant. The detail and list views (which use `Date` formatting) showed the
correct local time, so the form disagreed with the rest of the module.
`new Date('')` was also unguarded, so clearing the field threw on
`toISOString()`.

## Fix

`src/lib/appointments/datetime-local.ts` provides:

- `toDatetimeLocalValue(iso)` — UTC instant → `YYYY-MM-DDTHH:mm` in local time.
- `fromDatetimeLocalValue(value)` — local `YYYY-MM-DDTHH:mm` → ISO UTC.

`AppointmentForm` uses both for the Start Time value and change handler, and
clears the end time when the input is emptied. Duration changes still derive the
end time from the local start instant.

The pattern is timezone-agnostic: the test round-trips local values, so it
passes in any CI timezone.

## Verification

`src/lib/appointments/__tests__/datetime-local.test.ts` covers local display,
the reverse conversion, round-trips, minute precision and empty/invalid input.
