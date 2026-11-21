# Appointment overdue policy (ARGUS #126)

An appointment is **overdue** when it is still `SCHEDULED` or `CONFIRMED` and
its `startTime` is more than **15 minutes** in the past
(`APPOINTMENT_OVERDUE_GRACE_MINUTES`).

## Derived, never stored

Overdue is a display/filter state computed by
`src/lib/appointments/appointmentOverdue.core.ts`. Loading a page never mutates
an appointment row: four bookings from 29 Oct were still `SCHEDULED` on 20 Nov,
and silently rewriting them on read would destroy the real lifecycle history.

The stored status stays `SCHEDULED`/`CONFIRMED` until an operator resolves it.

## Where it appears

- **List** — the status cell shows an `Overdue` badge instead of the stale
  `Scheduled`/`Confirmed` badge, plus an explicit **Mark no-show** button (shown
  only to users holding `appointment:edit`).
- **Detail** — the badge is `Overdue` and an orange notice explains the grace
  window. The primary action becomes **Mark no-show**; check-in remains
  available as **Check in (late)** with an explicit confirmation, for the
  operator who knows the customer arrived late.
- **Filter** — the status filter has an `Overdue` option. The server translates
  it to `status IN (SCHEDULED, CONFIRMED)` and `startTime <= now - grace`; it is
  not a Prisma enum value.
- **Summary cards** — an `Overdue` card shows the tenant-wide count, independent
  of the selected day, so unresolved rows cannot disappear with date filters.

## Resolution

There is **no automatic no-show cron**. A cron would need its own audit trail and
could mark a customer who is merely late; the explicit operator action is the
safe rule. `Mark no-show` calls the existing `/no-show` endpoint (which now walks
the lifecycle map and frees the slot) after a confirmation.

Checking in an overdue row is a deliberate late-arrival exception: the UI asks
for confirmation and then calls the normal check-in route, which still honours
the transition/settings rules.

## Tests

`src/lib/appointments/__tests__/appointmentOverdue.core.test.ts` covers the
grace boundary, future/terminal states, the display-only `OVERDUE` value, an
invalid start time, and a caller-supplied grace period.
