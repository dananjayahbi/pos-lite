# M27-07 — Appointment hygiene bundle: BUG-89 (date-param 500s), BUG-91 (price Decimal ceiling 500), BUG-93 (audit `actorRole:'OWNER'` hardcoded), BUG-94 (verbatim script tags)

**Severity:** P3 bundle (one shared theme: validation + attribution) · **Module:** 27 Appointments · **QA pins:** `tests/27_appointments.spec.ts` N2, P2, A2, X2 · **Depends on:** XC-01 (params), INF-02 (mapping), M03-02 (actor threading pattern)

## Verified source state (2026-09-15)
1. **BUG-89:** stats/slots/time-off GETs pass `new Date(searchParams…)` unvalidated → `?from=abc` → 500 (same class as M09-01/M14-02/M17-02 — the fourth instance; use XC-01's `parseQueryDate`).
2. **BUG-91:** `appointment.validators.ts` price `z.number().min(0)` — no max; `1e12` exceeds the Decimal(10,2) column → P2002-style numeric overflow → 500 (fix: `.max(99999999.99)` + INF-02 net; same edit as M15-02's value bound).
3. **BUG-93:** `appointment.service.ts` hardcodes `actorRole: 'OWNER'` in 3 audit calls — **lines 138 (create), 220 (cancel), 479 (convert-to-sale)** — while `actorId` is the real user. A CASHIER's cancel records role OWNER. Fix pattern = M03-02: thread the actor (id + role) from the route session into the service functions (the routes already hold the session).
4. **BUG-94:** title/notes stored verbatim with `<script>` (X2 pin) — inert today (React escaping, grep-verified no `dangerouslySetInnerHTML` in appointment components). Policy doc: XC-04 decides strip-vs-escape; no code change until XC-04 lands.

## Fix approach
- Items 1+2: validator/query-param edits only (small, independent).
- Item 3: signature change `createAppointment(…, actor: {id, role, tenantId})` etc.; audit rows use the real role. Coordinate with M03-02's `writeAuditLog` helper so both modules share it.
- Item 4: track only; flip when XC-04 defines the policy.

## Files
- `appointment.service.ts` (3 audit sites + fn signatures), the appointment routes (pass actor), `appointment.validators.ts`, stats/slots/time-off routes.

## Acceptance / gate
- N2 → 400s; P2 → 400; A2 → audit row carries the acting user's real role (cashier cancel = CASHIER); X2 stays green (documented as policy-pending).
