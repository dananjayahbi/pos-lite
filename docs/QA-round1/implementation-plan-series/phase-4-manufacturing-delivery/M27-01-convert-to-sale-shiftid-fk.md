# M27-01 — BUG-85: appointment→sale conversion ALWAYS fails (`shiftId: ''` FK violation) — req 3.3 purchase-history link is dead

**Severity:** P1-Critical · **Module:** 27 Appointments · **QA pin:** `tests/27_appointments.spec.ts` F8 · **Depends on:** INF-02 (error surface), M18/shifts (active-shift lookup)

## Verified source state (2026-09-15) — still holds
- `src/lib/services/appointment.service.ts:457` — `convertAppointmentToSale` creates the Sale with `shiftId: '', // TODO: get active shift`.
- `prisma/schema.prisma:1030` — `Sale.shiftId String?` is **nullable** with an FK to `Shift`; `''` is neither NULL nor a valid id → Postgres FK violation → **every** convert attempt 500s (route catch at `convert-to-sale/route.ts:57-60` has no mapping). The `ALREADY_CONVERTED` 409 guard is unreachable behind the crash.

## Fix approach
1. **Resolve the shift properly:** look up the acting cashier's OPEN shift (the shift service already has a "current shift" query used by POS — reuse it). If none: per POS conventions either (a) reject with a typed 422 "An open shift is required to convert" (consistent with POS checkout's shift prerequisite, QA module 14), or (b) allow shift-less conversion by writing **null** (schema supports nullable). **Recommend (a)** for POS-initiated converts and (b) for owner-initiated (matches `CreateSaleSchema`'s shiftless-owner comment in `sale.validators.ts:52-53`).
2. Keep the `ALREADY_CONVERTED` guard functional; map its 409 through INF-02.
3. After fix, ensure the created Sale links back (`appointment.saleId` or the established linkage field) so req 3.3 "unified patient history" can join appointment→purchase (M27/REQ-04 surface).

## Files
- `appointment.service.ts` (convert fn), `convert-to-sale/route.ts`, shift lookup import, tests/27 F8.

## Acceptance / gate
- F8 flips: completed appointment + open shift → 201 with saleId; no open shift → 422 (not 500); double-convert → 409; sale appears in the customer's purchase history.
