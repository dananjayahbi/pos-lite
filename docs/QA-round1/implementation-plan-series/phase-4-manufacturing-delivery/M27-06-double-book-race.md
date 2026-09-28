# M27-06 — BUG-92: staff-overlap guard is non-atomic — concurrent bookings double-book the same slot

**Severity:** P2-Major · **Module:** 27 Appointments · **QA pin:** `tests/27_appointments.spec.ts` R2 · **Depends on:** XC-06 (race family)

## Verified source state (2026-09-15) — holds
- `src/lib/services/appointment.service.ts:91-104` — overlap check is `prisma.appointment.findFirst` (same staffId, non-CANCELLED/NO_SHOW, `startTime < endTime && gt`) throwing `STAFF_UNAVAILABLE` (102-103), executed **outside** the create transaction (`:106` starts the `$transaction` after). TOCTOU: QA's 3 concurrent same-staff/same-slot creates ALL returned 201. No DB-level exclusion constraint exists (`(tenantId, staffId, tstzrange)` exclusion would be the Postgres-native guard).

## Fix approach (two layers)
1. **Move the overlap check INSIDE the transaction and lock:** inside `$transaction`, `SELECT … FOR UPDATE` the conflicting-window rows (raw locking query on `appointments WHERE staffId=$1 AND status NOT IN ('CANCELLED','NO_SHOW') AND daterange/` && ` window`) before creating. Serializes same-slot writers; loser sees the committed row → 409 `STAFF_UNAVAILABLE`. (Matches M16-01's lock pattern — same helper idea.)
2. **DB guarantee (preferred long-term):** Postgres `btree_gist` extension + `EXCLUDE USING gist (tenantId WITH =, staffId WITH =, tstzrange(startTime, endTime) WITH &&)` where status not cancelled — needs the extension enabled on the managed DB (check RDS/Supabase permissions; the repo's migrations run via `scripts/apply-sql-migration.mjs`). If the extension can't be enabled, layer 1 alone + a Vitest/Playwright race pin is acceptable.
3. Keep the friendly 409 for the sequential path (already works).

## Files
- `appointment.service.ts` (create fn), new migration (option 2), `tests/27` R2.

## Acceptance / gate
- R2 flips: 3 concurrent same-slot → exactly one 201, two 409, zero 500s; cancel-frees-window behavior (existing green) preserved.
