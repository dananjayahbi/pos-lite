# M27-03 — BUG-87: appointment reminders route has no tenant scoping (IDOR — cross-tenant patient PII read)

**Severity:** P1-Critical (security) · **Module:** 27 Appointments · **QA pin:** `tests/27_appointments.spec.ts` S6 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/appointments/reminders/route.ts:16-25` — reads `appointmentId` from the query and calls `getReminderHistory(appointmentId)` with **no tenant check**; the route doesn't even require `tenantId` to exist.
- `src/lib/services/appointment-reminder.service.ts:112-117` — `findMany({ where: { appointmentId } })` — bare id, no `tenantId` filter, even though `AppointmentReminder` carries `tenantId` (`schema.prisma:1852`).
- Impact: any logged-in user of any tenant can read another tenant's reminder history (patient name/phone/appointment details) by guessing appointment ids.

## Fix approach
1. `getReminderHistory(tenantId, appointmentId)` — add `tenantId` to the where clause AND verify the parent appointment belongs to the tenant (or rely on the reminder's own tenantId column — it's populated).
2. Route: pass `session.user.tenantId` (make it required — reject tenantless callers like siblings do); apply the same `viewAppointment` (or appointment-owner) gate the detail GET uses.
3. Audit sibling reminder-adjacent routes for the same bare-id pattern while in the file.

## Files
- `appointment-reminder.service.ts`, `reminders/route.ts`.

## Acceptance / gate
- S6 flips: dilani books → lanka owner reads reminders → 404; same-tenant owner → 200. Note the reminders pipeline itself is dead code (M27-08) — the IDOR must be fixed regardless because the route is live.
