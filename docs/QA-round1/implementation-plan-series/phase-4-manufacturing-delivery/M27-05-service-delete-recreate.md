# M27-05 — BUG-90: appointment-service DELETE has no in-use guard, and recreate-after-soft-delete → 500 (P2002 unmapped)

**Severity:** P2-Major · **Module:** 27 Appointments · **QA pin:** `tests/27_appointments.spec.ts` F10 · **Depends on:** INF-02, M04-01 (same fix template)

## Verified source state (2026-09-15) — holds (and the 500 is worse than QA's "409" note)
- `src/app/api/store/appointments/services/[id]/route.ts:112-152` DELETE → `deleteAppointmentService` (`appointment.service.ts:376-386`) — soft-deletes (`deletedAt`) with **no check for future/active appointments referencing the service** (no `Appointment.serviceId` count anywhere) → linked appointments orphan onto a dead service row.
- Recreate path: `AppointmentService` has `@@unique([tenantId, name])` (`schema.prisma:1758`) which **includes soft-deleted rows**, while `createAppointmentService`'s pre-check filters `deletedAt: null` (`appointment.service.ts:326-329`) → recreate passes the pre-check, hits P2002; route catch maps only the exact `SERVICE_NAME_EXISTS` message (`services/route.ts:84-89`) → **500** (QA observed "recreate → 500"; the mechanism is the unmapped P2002, not a 409).

## Fix approach
1. **In-use guard:** before soft-delete, `count` appointments referencing the service with `status in {SCHEDULED, CONFIRMED, CHECKED_IN}` and `startTime >= now` → block with 409 `SERVICE_IN_USE` (mirror `CATEGORY_IN_USE`/`BRAND_IN_USE` semantics + message style). Historical (completed/cancelled/past) references don't block — the FK row survives soft-delete anyway.
2. **Recreate:** INF-02's P2002→409 mapping gives the friendly `SERVICE_NAME_EXISTS` 409 (same one-line fix class as M04-01). Decide name policy: recommend names stay reserved while any row exists (consistent with Category/Brand), stated in the 409 message.
3. UI: delete button shows the blocked-lock affordance (shared component from M04-02) when in-use.

## Files
- `appointment.service.ts` (delete + create), `services/[id]/route.ts`, `services/route.ts`, services list UI.

## Acceptance / gate
- F10 flips: delete-with-future-appointments → 409 SERVICE_IN_USE; recreate-deleted-name → 409 (not 500); delete-unused → 200 + hidden from list (existing A-series semantics).
