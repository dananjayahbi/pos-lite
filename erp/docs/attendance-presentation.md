# Attendance presentation (ARGUS #360)

- Timeclock history dates now render `14 Nov 2026` instead of the locale
  default `11/14/2026`, matching the staff detail header.
- A shift is labelled by when it opened (`Shift 14 Nov 2026, 09:00`) with the
  full shift id as the tooltip, rather than an 8-character id fragment. If the
  opened time is unavailable the label falls back to `Shift <id prefix>`.
- The daily attendance table still shows the earliest clock-in/latest clock-out
  and the `Punches` action opens every interval and the gaps between them.
- Helpers live in `src/lib/attendance/attendancePresentation.core.ts` and are
  covered by `attendancePresentation.core.test.ts`.
- `tests/20_timeclock_commissions.spec.ts` now also covers the Attendance page
  table/summary, the self clock control, the Adjust/Status dialogs, the punches
  dialog and the cross-day punch guard (T9-T11).
