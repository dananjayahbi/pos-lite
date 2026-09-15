# M01-06 — Middleware hardening: `proxy.ts` migration + fail-closed gates (corrected BUG-13)

**Severity:** P1 (security architecture) · **Module:** 01 Auth · **QA pins:** `tests/01_auth.spec.ts` 1.3-note, 8.3, 10.3 · **Depends on:** nothing · **Blocks:** M03-03, M03-04, M08-01 (they change gate *behavior*; this doc fixes the *foundation*)

## ⚠️ Correction to QA's BUG-13 (verified 2026-09-15)
QA reported: "the edge `middleware.ts` **never executes** under Next 16/Turbopack (deprecated convention → `proxy.ts`)" and called it the shared root cause of BUG-5/BUG-9. **On this branch that diagnosis no longer holds:**
- `erp/middleware.ts` (309 lines) **is** bundled and executed — `.next/dev/server/middleware-manifest.json` registers `"sortedMiddleware":["/"]` and the dev log shows `Compiling middleware`.
- Next 16.1.7 only *deprecates the filename*; `middleware.ts` still runs (warning: "Please use proxy.ts instead").
- The QA evidence was captured on a different checkout (`e:\my_github_repos\pos_lite`) from a possibly stale Turbopack cache (their own forensics note 1 describes exactly that phantom).

**Therefore: do NOT "migrate to fix a dead file."** The gates exist but are **fail-open** and split across two runtimes — that is the real defect set:

| Location | Current behavior | Problem |
|---|---|---|
| `middleware.ts:190-212` sessionVersion gate | compares only when `typeof dbSessionVersion === 'number' && typeof tokenSessionVersion === 'number'` | bridge fetch fails / returns `{sessionVersion:null}` (deleted user) / non-OK → check **silently skipped** → stale token keeps working (this, not a dead file, is why force-logout "does nothing" — BUG-5) |
| `middleware.ts:291-296` outer catch | `NextResponse.next()` on *any* middleware error | total fail-open |
| `middleware.ts:234-254` suspension gate | `isSuspensionBypassPath` (65–74) skips **all `/api/` paths** + `/auth/`; also `if (res.ok)` then skip | suspended tenant keeps full API access with an already-loaded SPA (BUG-35 half) |
| `src/app/api/internal/middleware/route.ts:37-39` | `checkTenantStatus` with missing tenantId → **400** | middleware's `res.ok` guard turns a caller bug into a silent skip (NEW-B) |
| Node vs Edge caches | `src/lib/auth/session-version-cache.ts` (Node Map) vs a **separate** Edge `Map` in `middleware.ts:16-17` (5 s TTL) | `clearSessionVersionCacheForUser` only clears the Node copy — Edge stays stale up to 5 s (minor) and the two never agree under load |

## Fix approach
1. **Rename to the Next 16 convention anyway** — move `erp/middleware.ts` → `erp/src/proxy.ts` (same exports; matcher + config move with it). This is a *hygiene* change that removes the deprecation warning and matches framework direction; it changes no behavior. Verify the proxy manifest registers identically before/after. (If any Next 16.1.7 quirk makes `proxy.ts` skip `src/app/api/internal` loop-prevention, keep `middleware.ts` and document — do not ship a regression to "fix the filename.")
2. **Fail-closed sessionVersion gate:** when the bridge returns non-OK / null-for-existing-user, treat as *deny* (redirect `/login?sessionExpired=true`) rather than skip. Keep a narrow allowlist for genuinely public paths (already public-path fast-path at 154–157 covers those). Deleted-user `null` → deny.
3. **Single cache strategy:** drop the Edge Map; call the bridge per request but with the bridge's own (Node, short-TTL) cache — or keep the Edge cache and reduce TTL to ≤1 s with an explicit `force-logout` invalidation documented as ≤TTL eventual. Pick one and write the invariant in a comment; the QA contract "wait > 5 s then browse" (BUG-5 repro) must pass.
4. **Suspension gate:** remove the blanket `/api/` bypass → check tenant status for `/api/store/*` (not `/api/auth/*`, `/api/webhooks/*`, `/api/public/*`, `/api/cron/*`, `/api/internal/*`); on SUSPENDED return **403 JSON** for API paths and redirect `/suspended` for pages. Bridge: `checkTenantStatus` missing tenantId → 200 `{status:null}` (explicit "no tenant" answer) instead of 400, so the middleware decision is data-driven (NEW-B).
5. **SUPER_ADMIN funnel + tenantless users** stay middleware-level; the page-guard conflict (BUG-9) is fixed in M03-07 (page level), not here.

## Files
- `erp/middleware.ts` → `erp/src/proxy.ts` (move + edits), `src/lib/auth/session-version-cache.ts`, `src/app/api/internal/middleware/route.ts`, `src/lib/api/permission-guard.ts` (if the 403 helper lands there via INF-02).

## Acceptance / gate
- `tests/01_auth.spec.ts` 10.3 (sessionVersion bump kills live JWT) green deterministically (was flaky); 8.3 (callbackUrl present on unauth bounce) green.
- New/extended: suspended tenant's `GET /api/store/customers` → 403 after suspension (M08-01's data-level half); force-logout → next request (≤ cache TTL) bounced to `/login?sessionExpired=true` (flips `tests/03` 10.2 together with M03-03).
- Zero `middleware` deprecation warnings in a cold dev boot log.

## Sequencing note
M03-03 (force-logout) and M08-01 (suspension) build on this foundation; implement this doc first in any session that includes them.
