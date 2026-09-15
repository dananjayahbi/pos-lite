# M03-02 — BUG-4 (+NEW-A): staff audit rows record no actor, and audit writes are fire-and-forget-swallowed

**Severity:** P1-Critical (defeats req 3.11 "Security, Auditing") · **Module:** 03 RBAC/Users · **QA pin:** `tests/03_rbac_users.spec.ts` 4.3 · **Depends on:** nothing · **Related:** M27-07 (same bug class in appointments)

## Verified source state (2026-09-15) — still holds
- `src/lib/services/staff.service.ts:98` — `updateStaff(tenantId, id, data)`: **no actor parameter in the signature at all.**
- STAFF_ROLE_CHANGED audit (130–141) and STAFF_PERMISSION_CHANGED audit (150–161): both hard-code `actorId: null` (133/153) and `actorRole: 'SYSTEM'` (134/154).
- `src/app/api/store/staff/[id]/route.ts:116` — the PATCH route **has the session** (fetched line 63) but never passes it down.
- **NEW-A:** both calls are `void createAuditLog(...).catch(() => {})` — a failed audit write vanishes silently.
- Same hardcoding pattern exists in appointments (`actorRole:'OWNER'` at `appointment.service.ts:138,220,479` — tracked in M27-07).

## Fix approach
1. **Thread the actor through:** extend `UpdateStaffInput`/service signatures with an `actor: { id, role, tenantId }` (from session) — routes already hold the session; pass it. Do the same for `createStaffMember` (POST route has session too).
2. **Audit-write durability policy (shared helper):** add `writeAuditLog(entry)` in `src/lib/services/audit.service.ts` that awaits the write and on failure logs server-side (Sentry) — for *security-relevant* trails (staff role/permission changes, force-logout) the route should surface a 500 if the audit could not be written, because an unaudited privilege change is worse than a failed request. For best-effort trails (view-ish events) keep fire-and-forget **but with a console/Sentry error on failure**, never a silent `.catch(() => {})`.
3. Remove the `'SYSTEM'` literals: actorRole comes from the session. Keep `actorRole:'SYSTEM'` legal only for genuinely system-originated writes (cron), which is none of these.

## Files
- `src/lib/services/staff.service.ts`, `src/app/api/store/staff/route.ts`, `src/app/api/store/staff/[id]/route.ts`, `src/lib/services/audit.service.ts` (helper), `src/lib/types/audit.ts`-equivalent if types live elsewhere.

## Acceptance / gate
- `tests/03` 4.3 flips: audit row for a role change carries the OWNER's `actorId` + `actorRole:'OWNER'`; permission-change row likewise (tests 3.1/3.2 already assert before/after diffs — those keep passing).
- Vitest: `writeAuditLog` failure path → error surfaced (mocked reject), route returns 500 for staff mutations when the audit write fails (security decision — document in PR).
