# M27-02 — BUG-86: complete / no-show / convert-to-sale have NO permission gate (any authenticated staff completes appointments); time-off GET same class (OBS-80)

**Severity:** P1-Critical (RBAC bypass) · **Module:** 27 Appointments · **QA pin:** `tests/27_appointments.spec.ts` S3 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/appointments/[id]/complete/route.ts:11-24`, `no-show/route.ts:11-24`, `convert-to-sale/route.ts:11-24` — each checks only `session?.user` + `tenantId`; **no `hasPermission` call anywhere in the three files**. CASHIER gets 200 completing/no-showing any appointment (and reaches convert's crash).
- The correct pattern exists in siblings: `cancel/route.ts:29` (`APPOINTMENT.cancelAppointment`), `check-in/route.ts:28` (`checkInAppointment`), `[id]/route.ts` GET/PATCH/DELETE (34/84/148).
- **OBS-80:** `time-off/route.ts` GET (8-42) is session+tenant only while its POST gates `manageSchedule` (62) and every other list route (appointments/availability/services/stats) gates `viewAppointment` — GET time-off is the outlier.

## Fix approach
1. Add gates mirroring the siblings. `PERMISSIONS.APPOINTMENT` (permissions.ts:105-113) has `viewAppointment`/`createAppointment`/`editAppointment`/`cancelAppointment`/`checkInAppointment`/`manageServices`/`manageSchedule`/`manageSettings` — **no `completeAppointment`**. complete/no-show are status transitions → gate them on **`editAppointment`** (the natural existing key; no new constant needed). convert-to-sale creates a Sale → require **both `editAppointment` AND `SALE.create`** (it is a financial write, not just a status flip). Decide during impl whether to add a dedicated `completeAppointment` key instead of reusing edit — recommend reusing edit to avoid expanding the permission surface.
2. time-off GET → `viewAppointment` (align with siblings) — or `manageSchedule` if the roster's leave data is schedule-admin territory; recommend `viewAppointment` since the calendar already shows availability.
3. Re-run the RBAC matrix (S3) after gating; cashier legitimate paths (view/create/check-in) must stay 200.

## Files
- the three `[id]/*` route files, `time-off/route.ts`, `src/lib/constants/permissions.ts` (possible new key + role assignments).

## Acceptance / gate
- S3 flips: CASHIER complete/no-show/convert → 403; OWNER/MANAGER → 200 flows still green (F-series lifecycle); time-off GET cashier → 403 per chosen key.
