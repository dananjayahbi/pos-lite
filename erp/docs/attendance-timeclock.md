# Attendance & time clock

## Global clock control

`TimeClockWidget` is rendered in the store header (next to notifications) in a
compact variant, so any signed-in user can clock in/out from any page that uses
the store layout. The widget reads the current user's status from
`GET /api/store/timeclock/me` and invalidates both the header status and the
attendance table after a punch.

The old "Clock actions" card was removed from the attendance page; clocking is
now exclusively in the header.

## All-staff daily attendance

The attendance page (`/staff/timeclock`) no longer has a single-employee
dropdown. It shows every active staff member for one selected date:

| Column | Meaning |
| --- | --- |
| Staff | Display name (derived from email) + email |
| Role | OWNER / MANAGER / CASHIER / … |
| Status | Present / Absent / Leave / Half Day / Holiday |
| Clock In / Out | Earliest clock-in and latest clock-out for the day |
| Worked | Sum of all punches that day |
| OT | Time beyond the 8-hour standard workday |
| Actions | Adjust clock times, mark attendance status |

A **Date** picker and **Today** shortcut switch the day. Changing the date
re-fetches the whole table. Summary cards show Present / Absent / On Leave /
Half Day counts and total OT for the selected day.

Status derivation:

- An `AttendanceDay` override (Leave/Absent/Half Day/Holiday/Present) wins.
- Otherwise any punch on that day means **Present**.
- Otherwise **Absent**.

## Overtime

`STANDARD_WORKDAY_MINUTES = 480` (8 hours). For each staff member:

```
workedMinutes   = Σ (clockedOutAt ?? now) − clockedInAt
overtimeMinutes = max(0, workedMinutes − 480)
regularMinutes  = workedMinutes − overtimeMinutes
```

Open punches count up to the current time; the table shows them with an
**Active** badge until they are closed. Multiple punches in one day are summed
before the OT split.

## Adjust clock times

`PATCH /api/store/timeclock/[id]` (permission `staff:attendance:manage`)

```json
{ "clockedInAt": "2026-11-06T08:00:00.000Z", "clockedOutAt": "2026-11-06T18:00:00.000Z" }
```

- `clockedOutAt: null` leaves the punch open.
- Clock-out must be after clock-in.
- If the edited record is the user's open punch, `User.clockedInAt` is updated
  or cleared in the same transaction, so the header widget stays accurate.
- Adjustments are audited (`ATTENDANCE_ADJUSTED`).

The UI's Adjust dialog lists every punch for the day. Open punches show an empty
clock-out field with a hint to set the real end time (the forgotten-clock-out
case).

## Leave / absent management

`POST /api/store/timeclock/attendance` (permission `staff:attendance:manage`)

```json
{ "userId": "cm...", "date": "2026-11-06", "status": "LEAVE", "notes": "Approved leave" }
```

Upserts one `AttendanceDay` row per tenant/user/date. Statuses: `PRESENT`,
`ABSENT`, `LEAVE`, `HALF_DAY`, `HOLIDAY`. The row is an overlay — the punches
remain intact, so switching back to Present still shows the worked time.
Status changes are audited (`ATTENDANCE_STATUS_SET`).

## Data model

Migration `20261106030000_add_attendance_days` adds:

- enum `AttendanceStatus`
- table `attendance_days` (tenant/user/date unique, status, notes, recorder)

`TimeClock` remains the source of truth for punches; `AttendanceDay` only
carries the human status.

## Permissions

- View the table: `staff:attendance:view` (`PERMISSIONS.STAFF.viewAttendance`)
- Adjust punches / mark status: `staff:attendance:manage`
  (`PERMISSIONS.STAFF.manageAttendance`) — OWNER and MANAGER have it.

`hasPermission()` now evaluates the effective role defaults plus explicit
overrides, so a newly added permission works for an already signed-in OWNER
without forcing a re-login.

## Tests

`src/lib/services/__tests__/timeclock-attendance.test.ts` covers:

- 8-hour standard day → 0 OT
- 9h30 → 1h30 OT
- multiple punches summed before the OT split
- open punch counted to now
- negative-duration guard
- `YYYY-MM-DD` date parsing/formatting
