# Appointment reminders (ARGUS #135)

The live tenant has ~70 reminders stuck in `PENDING`; the UI only showed a
summary line inside one appointment, and the Settings switches had no visible
effect.

## Policy from the Settings switches

`enabledReminderOffsetsHours(settings)` in
`src/lib/appointments/appointmentSettings.core.ts` maps the two reminder
switches to offsets `[24, 2]`. `scheduleReminders()` now builds one `PENDING`
row per enabled offset, still skipping offsets that are already in the past.
Turning a switch off therefore stops scheduling that reminder for new bookings;
rows already queued keep their own status.

## Status surfaces

- `GET /api/store/appointments/reminders` still accepts
  `?appointmentId=…` for one booking but now returns
  `{ reminders, summary }`.
- Without `appointmentId` it returns the tenant-wide queue, pending first,
  capped at `limit` (1–100, default 25), with counts by status. Both scopes use
  the existing `appointment:view` permission and tenant filter.
- The appointment detail panel lists each reminder with channel, scheduled
  time, sent time, failure reason and a `Pending`/`Sent`/`Failed` badge.
- The Settings tab adds a **Reminder Delivery** card: pending/sent/failed counts
  plus the first queued rows, so the 70 pending reminders are visible.

`src/lib/appointments/appointmentReminders.core.ts` owns the status labels,
buckets and counts so both surfaces agree.

## Tests

- `__tests__/appointmentReminders.core.test.ts` — status counting, group-by
  buckets, labels, empty lists.
- `__tests__/appointmentSettings.core.test.ts` — both switches on, either off,
  both off.
