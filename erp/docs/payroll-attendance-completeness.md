# Payroll attendance completeness (ARGUS #376)

## Problem

Payroll derives no-pay days from the shared attendance calendar
(ARGUS #348): a scheduled working day with no punch is `ABSENT`, weekends and
holidays are never absent, and future days are `SCHEDULED`. That derivation is
correct, but an entirely empty month looked normal: September had 0 attendance
rows and 0 punched days, every scheduled day was inferred as absent (or, when a
person had no scheduled days in the period, nothing was deducted and the full
salary was paid), and the preview gave no warning that attendance was
incomplete.

## Completeness model

`src/lib/payroll/attendance-completeness.core.ts` is pure and unit tested:

| Expected days | Recorded days | Status | Meaning |
| --- | --- | --- | --- |
| 0 | 0 | `NOT_SCHEDULED` | no scheduled days in the period - a paid row would get no attendance deduction |
| > 0 | 0 | `NO_DATA` | no attendance records at all |
| > 0 | < expected | `PARTIAL` | some working days have no record |
| > 0 | = expected | `COMPLETE` | every scheduled day has evidence |

- **Expected** = rows whose calendar status is `PRESENT`, `ABSENT`,
  `INSUFFICIENT`, `LEAVE` or `HALF_DAY` (past/today working days).
- **Recorded** = rows with at least one punch, plus explicit `LEAVE` overrides.
- `missingDays` is clamped at zero, so malformed counts cannot produce a
  negative gap.

`summarizeAttendanceCompleteness(rows)` collects the affected staff, the total
unrecorded days and one message. `NO_DATA` and `NOT_SCHEDULED` require an
explicit confirmation; `PARTIAL` is always shown as a warning but does not block
a normal month where a few days were simply not punched.

## Enforcement

The preview now returns `attendanceSummary` and each row returns
`attendanceCompleteness` (label, expected/recorded/missing days). The Run Payroll
page shows an **Attendance check** card with the affected staff list and a
per-row `N unrecorded` hint.

`POST /api/store/payroll/runs` re-derives the summary server-side. If a
confirmation-required state is present and `confirmIncompleteAttendance` is not
`true`, generation is refused with `422 INCOMPLETE_ATTENDANCE` and details
listing the staff with no data / no scheduled days. The UI requires the
acknowledgement checkbox before enabling **Generate payroll**.

Absence derivation itself is unchanged: no schema change or migration, and the
same calendar is still the single source of truth for the daily page, the
attendance report and payroll.
