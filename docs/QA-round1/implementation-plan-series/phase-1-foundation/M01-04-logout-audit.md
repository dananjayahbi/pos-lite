# M01-04 — BUG-12: sign-out is audit-blind (LOGOUT action declared, never written)

**Severity:** P2-Major (audit completeness; req 3.11) · **Module:** 01 Auth · **QA pin:** `tests/01_auth.spec.ts` 4.5 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `AUTH_ACTIONS.LOGOUT` is defined at `src/lib/services/audit.service.ts:34` with **zero call sites** repo-wide (`FORCE_LOGOUT_TRIGGERED` exists separately and *is* written by the force-logout route).
- Sign-out is client-triggered: `SignOutButton.tsx:30`, `StoreLayoutClient.tsx:72`, `ShiftOpenModal.tsx:97` call `signOut()` from `next-auth/react`, which POSTs `/api/auth/[...nextauth]` — the route exports bare `handlers` with no hook, so no server-side record is ever made.
- Result: the ledger answers "when did this user last sign in?" but never "did they sign out?" — session forensics value halved (QA test 4.4 proves the ledger is append-only; 4.5 proves LOGOUT count stays 0).

## Fix approach
NextAuth v5 (beta.30) emits an `EVENTS.SIGN_OUT` (verifiable in `@auth/core` events) — wire it in the auth config:
1. In `src/lib/auth.config.ts` (or `auth.ts` where the LOGIN audit rows are already written, `auth.ts:66-121`), add an `events.signOut` handler: resolve the user from the session token and `createAuditLog({ action: AUTH_ACTIONS.LOGOUT, entityType:'User', actorId: user.id, actorRole: user.role, tenantId })`. Await/`void` with `.catch` + a console error — **not** a silent swallow (NEW-A principle: failed audit writes must at least log; full durability policy is M03-02's shared helper).
2. Verify empirically that the NextAuth beta's signOut POST fires the event server-side; if it does not (beta gap), fallback: add a tiny `POST /api/auth/logout-audit` called by the three client sign-out sites *before* `signOut()` completes — one shared helper in `src/lib/auth/logout-audit.ts` so the three components don't diverge. Decide during implementation; document choice in the PR.
3. Do not log secrets/cookies; include `ipAddress` like LOGIN rows for parity.

## Files
- `src/lib/auth.config.ts` / `src/lib/auth.ts` (event handler), possibly `src/app/api/auth/[...nextauth]/route.ts` (wrapped handlers), `src/lib/auth/logout-audit.ts` (helper), three client call sites only in the fallback path.

## Acceptance / gate
- `tests/01_auth.spec.ts` 4.5 flips to expect ≥1 `LOGOUT` row for the owner after a UI logout, with correct actorId/actorRole/tenantId.
- 4.1/4.2 (existing logout-invalidates-session contracts) stay green.
