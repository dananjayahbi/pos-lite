# Status overrides and worked hours

An explicit `AttendanceDay` status is authoritative for payroll. Before ARGUS
#358, marking Leave/Absent/Half Day on a day with punches left the worked,
regular and overtime minutes in place, so a Leave row could show 8h worked and
feed OT into payroll.

## Rule

`src/lib/attendance/attendanceMinutes.core.ts`:

| Explicit status | Worked / regular | Overtime | Flag |
| --------------- | ---------------- | -------- | ---- |
| `LEAVE` | 0 | 0 | `CLEARED` |
| `ABSENT` | 0 | 0 | `CLEARED` |
| `HOLIDAY` | 0 | 0 | `CLEARED` |
| `HALF_DAY` | min(worked, `halfDayMinutes`) | 0 | `HALF_DAY_CAP` when it changed anything |
| `PRESENT` | real punched minutes | real OT | `NONE` |
| no override / derived status | real punched minutes | real OT | `NONE` |

`originalTotalMinutes` preserves what the punches actually totalled for
diagnostics. The `TimeClock` rows are never edited; only the derived attendance
view and payroll inputs are reconciled.

A derived Half Day (from punched hours, no `AttendanceDay` row) is not capped a
second time.

## Applies to

- **Daily attendance table** (`getDailyAttendance`): row totals and OT use the
  rule; `hoursAdjusted` drives a small "by Leave" note under Worked.
- **Monthly attendance report / CSV / payslip / payroll preview**
  (`getStaffAttendanceReport`): each row's totals use the same rule, and the
  report's `totalMinutes`, `regularMinutes` and `overtimeMinutes` are summed
  from the adjusted rows. Payroll therefore no longer pays OT for a Leave day.
- Status counts (`daysPresent`, `daysAbsent`, etc.) already came from the
  calendar/status and are unchanged.

## Verification

`src/lib/attendance/__tests__/attendanceMinutes.core.test.ts` covers Leave,
Absent, Holiday, Half Day capping, short Half Day, explicit Present, derived
Half Day, and negative-minute guarding.
