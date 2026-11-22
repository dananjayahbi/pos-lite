# Attendance months and commission periods

Two month-window bugs shared one root cause: a calendar month was treated as a
set of punches or as a UTC slice of a local date (ARGUS #343).

## Attendance: absence comes from the calendar

`getStaffAttendanceReport` (used by the attendance CSV, the payslip and the
payroll preview) walks `buildAttendanceCalendarRows` for every day in the
month. It no longer emits only dates with a punch or an override.

For each day:

- an explicit `AttendanceDay` override wins;
- a configured holiday is `HOLIDAY`;
- a non-working weekday (weekend) is `OFF`;
- a working day before employment is `OFF`;
- a past working day with no punch is `ABSENT`;
- a future working day is omitted (never `ABSENT`);
- punched days are graded by worked minutes (`PRESENT`, `HALF_DAY`,
  `INSUFFICIENT`).

Therefore a fully past month with no punches reports `present: 0` and one
`ABSENT` per working day, with weekends/holidays excluded. `daysAbsent` in the
report is `ABSENT + INSUFFICIENT`, which is what payroll uses for no-pay days.

The working week and holidays come from `Tenant.settings.attendance`
(`workingDays`, `holidays`); defaults are Monday-Friday with no holidays.

## Commission: inclusive local month

`resolveCommissionPeriod` (`src/lib/utils/commission-period.ts`) turns a
`periodStart`/`periodEnd` pair into local calendar days:

- `periodStart` = local `00:00:00.000` on the first day;
- `periodEnd` = local `23:59:59.999` on the last day;
- no inputs = the current local month;
- a missing end = the end of the start month;
- a missing start = the first of the end month;
- a full ISO timestamp is passed through unchanged, so the browser's local
  month survives a UTC-hosted server;
- malformed or inverted windows raise `CommissionPeriodError`, which the API
  returns as `400 VALIDATION_ERROR`.

The commissions page uses the same helper to format its default dates
(`startDate`/`endDate`) and to build the ISO query strings (`startIso`/`endIso`).
It no longer slices `toISOString()` on a local midnight, which in UTC+05:30
produced 31 Oct - 29 Nov.

## Verification

- `src/lib/attendance/__tests__/attendanceCalendar.core.test.ts` covers a whole
  no-punch past month (21 absent / 9 off), a configured holiday (20 absent / 1
  holiday), and a current month with future days excluded.
- `src/lib/utils/__tests__/commission-period.test.ts` covers the inclusive
  local boundaries, month lengths, leap years, partial defaults, ISO inputs and
  invalid/inverted windows.
