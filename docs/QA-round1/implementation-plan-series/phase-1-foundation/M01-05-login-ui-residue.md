# M01-05 — Login UI residue: BUG-14/15 hardening, BUG-17 signed-in `/login`, NEW-E ignored `callbackUrl`

**Severity:** P2/P3 · **Module:** 01 Auth · **QA pins:** `tests/01_auth.spec.ts` 5.4 (BUG-14), 7.6 (BUG-15), 1.6 (BUG-17) · **Depends on:** nothing

## Verified source state (2026-09-15) — QA findings partially stale; residue real
`src/app/(auth)/login/page.tsx`:
- **BUG-14 (double-click → two callbacks):** submit button already `disabled={form.formState.isSubmitting}` (line ~196) with "Signing in…" label — the QA-era double-fire needs a click landing *before React commits* the disabled state. The DOM-disabled guard is real but not synchronous. **Residual risk stands** (QA reproduced deterministically with a forced second click).
- **BUG-15 (500 → silence):** `mapAuthError` (local, lines 30–47) has the fallback "Unable to sign in. Please try again." and the handler calls `setFormError(mapAuthError(result.error))` on error — but when `signIn({redirect:false})` itself **throws** (network 500 surface), the error path depends on whether the call is wrapped in try/catch; QA's mocked-500 pin (7.6) still fails on this branch's shape — verify live, then ensure the catch + fallback render exists.
- **BUG-17 (open):** nothing checks an existing session on `/login` mount; the `(auth)` layout is a plain wrapper. Signed-in users see the form (pinned 1.6).
- **NEW-E (open):** middleware redirects include `?callbackUrl=…` (middleware.ts:159–164) but the page's success path routes via `getDefaultRouteForRole` and **ignores callbackUrl** — a bounced user from `/customers/123` lands on `/dashboard`/`/pos` instead of the original target. (Also relevant to M01-07's sessionExpired flow.)

## Fix approach (one small doc, four independent edits in the same file)
1. **Synchronous submit guard:** module-level `submittingRef` checked+set at the top of `onSubmit` (in addition to DOM disabled) — kills the pre-commit double-click window.
2. **Wrap `signIn` in try/catch** → `setFormError(mapAuthError(undefined))` on throw; keep re-enable of the form (already correct per QA 7.2).
3. **Authenticated redirect:** server-side check in the `(auth)` layout or page (call `auth()`; if session → `redirect(getDefaultRouteForRole(role))`), which also fixes 1.6.
4. **Honor `callbackUrl`** when same-origin and present (validate host/path starts with `/` — never open-redirect), else role default. Keep the CASHIER "Open POS in this/new tab" dialog behavior (OBS-1 product decision — the dialog is intentional; automation contracts depend on it).

## Files
- `src/app/(auth)/login/page.tsx` (+ possibly `layout.tsx`).

## Acceptance / gate
- `tests/01_auth.spec.ts` 1.6 (signed-in `/login` redirects away) and 7.6 (500 → visible error text) flip green; 5.4 double-click → exactly 1 callback (forced-click variant); add a Vitest/Playwright check that a bounced `/customers/<id>` session returns to `<id>` after login.
