# Self punch audit

Manager adjustments and status overrides were audited, but a staff member's own
clock-in/clock-out wrote no audit row (ARGUS #357). Every self punch now creates
one:

| Action | When |
| ------ | ---- |
| `ATTENDANCE_CLOCKED_IN` | A self-service clock-in succeeds |
| `ATTENDANCE_CLOCKED_OUT` | A self-service clock-out succeeds |
| `ATTENDANCE_PUNCH_AUTO_CAPPED` | A clock-out hits the maximum-shift cap (existing) |
| `ATTENDANCE_ADJUSTED` | A previous-day punch is closed during clock-in, or a manager edits times |

## Payload

`src/lib/attendance/selfPunchAudit.core.ts` builds the `after` JSON:

```json
{
  "method": "SELF",
  "direction": "IN",
  "userId": "cm...",
  "timeClockId": "cm...",
  "occurredAt": "2026-11-06T03:30:00.000Z",
  "shiftId": "cm...",
  "durationMinutes": 480,
  "cappedAtMaxShift": false,
  "notes": "end of shift"
}
```

- `actorId` is the signed-in user; `actorRole` comes from the session.
- `method: "SELF"` distinguishes this from a manager adjustment.
- `timeClockId` points at the payroll source row. The audit never replaces or
  edits `TimeClock`; it is an append-only trail.
- The audit write is best-effort (fire-and-forget with a server-side error),
  consistent with the other attendance audit rows. A punch must not fail
  because the audit ledger is unavailable.

## Routes

- `POST /api/store/timeclock/clock-in` passes `session.user.role` in
  `ClockInOptions.actorRole`.
- `POST /api/store/timeclock/clock-out` passes `session.user.role` as the
  fourth argument to `clockOut`.

## Verification

`src/lib/attendance/__tests__/selfPunchAudit.core.test.ts` covers the distinct
actions, actor/method/timestamp fields, duration/capping on clock-out, the shift
reference and the guarantee that source punch fields are not overwritten.
