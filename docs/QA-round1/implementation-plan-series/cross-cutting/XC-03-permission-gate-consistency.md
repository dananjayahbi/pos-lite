# XC-03 — Page/API permission-gate consistency: one guard helper, no more denylists or auth-only surfaces

**Severity:** P2 (security-hygiene theme across 7+ observations) · **Type:** cross-cutting · **Depends on:** INF-02 (guard responses) · **Members:** BUG-80 (M07-01), OBS-41 (M29-03), OBS-51/52/55 (M31-02), OBS-4/8 (M05/M06 pages), OBS-80 (M27-02), OBS-36

## Verified source state (2026-09-15) — five distinct gate styles coexist
| Style | Examples (verified) | Problem |
|---|---|---|
| `hasPermission` key (correct) | taxes routes, stock-control routes, appointments most-routes | — |
| **role denylist** | hardware page+3 APIs (`DENIED_ROLES` sets, M07-01) | DISPATCH_STAFF slips through |
| **inline role arrays** | `timeclock/route.ts:26` `['MANAGER','OWNER']`, `commissions/payout/route.ts:33` | drift from `ROLE_PERMISSIONS` |
| **auth-only pages** | `/customers`, `/suppliers`, `/settings/website` (grep: zero permission checks in all 7 website routes), `/notifications` (shell only, API-gated) | dead chrome / writable surfaces for cashier |
| **auth-only APIs** | `api/customers/preview|count` (M05-05), `send-receipt` (M31-02), appointment complete/no-show/convert (M27-02), time-off GET (OBS-80), reminders (M27-03) | PII/message/status-write vectors |

Also: inconsistent denial UX — some pages redirect, some render "Permission Denied" cards (OBS-36 notes rate-card does the latter; `/settings/users` the former).

## Fix approach
1. **One API guard:** `requirePermission(permissionKey)` (extend `src/lib/api/permission-guard.ts` — it exists) returning `{session, tenantId}` or a typed 401/403 response per XC-02's code policy. Every store route uses it (each module doc lists its key; XC-03 provides the helper + a checklist sweep).
2. **One page guard:** `requirePageAccess({ permission?, requireTenant?, roleFunnel? })` in `src/lib/auth/page-guards.ts` implementing the M03-07 semantics (SUPER_ADMIN→/superadmin/dashboard, tenantless→/login, no-permission→ documented default redirect). Pages adopt it; choose ONE denial UX: **redirect to the role's landing with a toast** for whole pages, in-page denied card only for tabs/sections (record the convention in the roadmap's UI notes).
3. **Ban the denylist/inline-array pattern:** CI grep guard for `DENIED_ROLES` / `['MANAGER','OWNER'].includes` in `src/app/api/**` + `(store)/**/page.tsx` (like XC-01's guard).
4. Permission-key additions needed while sweeping: `settings:website` (M29-03), `sale:send_receipt` or reuse (M31-02), `appointment` complete/no-show/convert reuse `editAppointment` (M27-02), audience endpoints reuse the broadcast key (M05-05 decision).

## Files
- `src/lib/api/permission-guard.ts`, `src/lib/auth/page-guards.ts`, route/page call sites enumerated in the member docs, CI grep guard.

## Acceptance / gate
- Member-doc pins (tests/07 S4/S5, tests/29 S2/S3, tests/31 S3, tests/27 S3/S6, tests/03 8.x) all flip green under the shared guards; no route in `api/store/**` remains auth-only without a documented reason (audit list in PR).
