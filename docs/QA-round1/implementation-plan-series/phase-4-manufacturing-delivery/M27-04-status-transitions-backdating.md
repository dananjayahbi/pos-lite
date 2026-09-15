# M27-04 — BUG-88: no appointment status-transition guards (illegal jumps accepted) + OBS-79 backdated bookings

**Severity:** P2-Major · **Module:** 27 Appointments · **QA pins:** `tests/27_appointments.spec.ts` F6/F7 (+transition probes) · **Depends on:** M27-02 (gates first, then transitions)

## Verified source state (2026-09-15) — holds
- PATCH path: `src/app/api/store/appointments/[id]/route.ts:63-119` → `updateAppointment` (`appointment.service.ts:150-186`) — `if (input.status !== undefined) data.status = input.status` (177) then direct update (182). **No allowed-transitions map anywhere**; validators enum-check the value only (`appointment.validators.ts:67`). Observed: SCHEDULED→COMPLETED (skips check-in) 200; COMPLETED→CANCELLED 200 (erases a completed visit from revenue).
- **OBS-79:** `appointment.validators.ts:30` — `startTime: z.string().datetime()` shape-only; refines (41-48) check customer-presence + `endTime > startTime` — **nothing compares to now**. Backdated (and far-future) bookings accepted (service `:87-88` uses the date directly).

## Fix approach
1. **Transition table** (req 3.3 pipeline): `SCHEDULED → {CONFIRMED, CANCELLED, NO_SHOW}`, `CONFIRMED → {ARRIVED/CHECKED_IN, CANCELLED, NO_SHOW}`, `CHECKED_IN/WAITING → {COMPLETED, NO_SHOW, CANCELLED?}`, `COMPLETED → {}` (terminal), `CANCELLED/NO_SHOW → {}` (terminal; rebooking = new row). Encode as a const map in `src/lib/constants/appointments.ts`; enforce in `updateAppointment` when `status` present (throw `INVALID_STATUS_TRANSITION` → typed 409 via INF-02). Lifecycle sub-routes (confirm/check-in/complete/no-show/cancel) already exist — PATCH status edits should be *restricted to* the same legal edges (or PATCH status dropped entirely in favor of the action routes — recommend restricting, not removing, for admin correction flows with `manageSettings`).
2. **Terminal-state edit guard:** PATCH on COMPLETED/CANCELLED rows rejects field edits too (or logs them as amendments) — decide minimal: block status changes + price changes post-completion.
3. **OBS-79 backdate policy:** allow backdating only with `manageSettings`/owner permission (walk-in record-after-the-fact is a real clinic workflow); default: reject `startTime < now − 15min` with 400. Record the chosen grace in constants.

## Files
- `appointment.service.ts` (update fn), `src/lib/constants/appointments.ts` (new), validators, `tests/27` F6/F7 + new transition pins.

## Acceptance / gate
- Illegal jumps → 409/400; legal pipeline stays green; backdated default create → 400, owner-with-permission → 201.
