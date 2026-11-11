# Staff view: complete details and downloads

## Complete details

`GET /api/store/staff/[id]` now returns `lastLoginAt` in addition to the
existing fields. The staff detail page (`/staff/[staffId]`) shows every
non-sensitive account detail:

| Card | Source |
| --- | --- |
| Email | `email` |
| Role | `role` |
| Status | `isActive` |
| Commission Rate | `commissionRate` |
| Clocked In | `clockedInAt` |
| Joined | `createdAt` |
| Last Login | `lastLoginAt` (`Never` when null) |
| Explicit Permissions | `permissions[]`; empty means role defaults only |

## Downloads

A month picker in the staff header (`YYYY-MM`, defaults to the current month)
drives two downloads:

### Attendance CSV

`GET /api/store/staff/[id]/attendance/export?month=YYYY-MM`

- Permission: self, or `staff:viewStaff` for another user.
- Columns: `Date, Clock In, Clock Out, Worked, Regular, Overtime, Status,
  Punches, Notes`.
- Includes only days with a punch or an explicit `AttendanceDay` override.
- Overtime uses the same 8-hour standard as the attendance page.

### Payslip PDF

`GET /api/store/staff/[id]/payslip?month=YYYY-MM`

- Permission: self, or `staff:viewStaff` for another user.
- PDF sections:
  - business + staff identity,
  - attendance summary (days present/absent/leave/half day/holiday, worked,
    regular, OT),
  - commission summary (earned, paid, unpaid),
  - total payable (unpaid commission for the period).
- The footer notes that AyurPOS has no base-salary field, so the payslip covers
  attendance + commission earnings only.

Both endpoints use `resolveAttendanceMonth()` and return an attachment filename
containing the staff email local part and month.

## Tests

- `src/lib/utils/__tests__/attendance-period.test.ts` — month range resolution
  (including leap years) and minute formatting.
- `src/lib/services/__tests__/timeclock-attendance.test.ts` — OT/attendance
  arithmetic shared by the downloads.
