# M35-02 — OBS-72/73/75: middleware-bridge audit rows invisible to tenant feed; daily-summary email is a console.log that logs SENT; audit table fetch has no abort

**Severity:** P2 bundle (audit integrity + false-success bookkeeping) · **Module:** 35 Audit · **QA refs:** OBS-72, OBS-73, OBS-75 · **Depends on:** M01-06 (bridge contract), M31-01/INF-03 (email provider)

## Verified source state (2026-09-15)
1. **OBS-72 (holds):** `src/app/api/internal/middleware/route.ts:63-84` — the `createAuditLog` action destructures `tenantId` from the request body and writes `tenantId: tenantId ?? null` (line 75). The Edge middleware calls this bridge without a session, so middleware-emitted auth events (e.g. `SESSION_INVALIDATED_BY_VERSION_MISMATCH`) land with `tenantId: null` → **invisible** to the tenant-scoped `/api/audit-logs` feed (`where: { tenantId }`). QA probe-confirmed: rows written, tenant query returns 0.
2. **OBS-73 (holds, worse than reported):** `src/app/api/cron/daily-summary/route.ts:153-162` — `// TODO: Replace console.log with Resend email sending when API key is available` then `console.log(...)`, then writes `dailySummaryLog` status **`'SENT'`** though nothing was emailed — a false-success ledger (same anti-pattern family as BUG-11/73).
3. **OBS-75 (partially stale):** `src/components/audit/AuditLogTable.tsx:98-106` now uses react-query `useQuery` (not raw useState/useEffect) — but the `queryFn` fetch (101) does **not** pass the react-query `signal` → in-flight requests aren't cancelled on filter change; out-of-order responses could render stale results (last-write-wins not guaranteed). The substance (no abort) holds; the mechanism description was outdated.

## Fix approach
1. **Bridge tenant context:** the middleware knows the tenant (it resolved `user.tenantId` for the sessionVersion/suspension checks) — pass it in the `createAuditLog` body so rows are tenant-attributed. For genuinely system-level events (no tenant), keep null but surface them via the M08-03 SUPER_ADMIN cross-tenant audit view so they aren't silently lost.
2. **Daily-summary honesty:** attempt the real `sendEmail` when `RESEND_API_KEY` is set; on unconfigured/failure, log status `PENDING`/`FAILED` (not `SENT`) with the reason — mirror M31-01's structured-reason pattern. Add the Resend send once INF-03 supplies the key.
3. **Abort on fetch:** pass `({ signal }) => fetch(url, { signal })` to useQuery's queryFn (react-query supports it) — one-line fix, prevents stale renders + wasted bandwidth on rapid filter spam (R3).

## Files
- `api/internal/middleware/route.ts` (accept+store tenantId), the middleware call site (pass tenantId), `cron/daily-summary/route.ts`, `AuditLogTable.tsx`.

## Acceptance / gate
- `tests/35` F14/R2 updated: bridge-written audit rows carry the acting tenant and appear in that tenant's feed (or in the SUPER_ADMIN view); daily-summary with no key → status ≠ SENT; audit table filter-spam renders the final filter's result (no stale flash).
