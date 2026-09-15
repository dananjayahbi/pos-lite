# M05-05 — BUG-74 + OBS-51: audience endpoints (`/api/customers/preview`, `/count`) crash on unvalidated params and expose customer PII to every role

**Severity:** P2-Major · **Module:** 05 Customers / broadcast audience · **QA pins:** `tests/31_communications.spec.ts` P2, X4, S3 · **Depends on:** XC-01 (param parsing), XC-03 (permission-gate consistency)

## Verified source state (2026-09-15) — still holds (both halves)
**Crashes (BUG-74):**
- `src/app/api/customers/preview/route.ts:53,60` and `count/route.ts:54,61` — `parseFloat(minSpend)` with no NaN guard → `NaN` into Prisma Decimal filter → **500**.
- `preview/route.ts:47` / `count/route.ts:48` — `where.gender = gender as Gender` — arbitrary string cast straight to the Prisma enum → `gender=💥` → **500**.
- Safe today (must stay): `minSpend=1e20` → 200, `birthdayMonth=99` → ignored 200 (QA P2/X4 pins).
**PII exposure (OBS-51):**
- Both routes check only `session?.user` + `tenantId` (`preview:9-21`, `count:9-21`) — **no `hasPermission`** anywhere in `src/app/api/customers/**` (grep-confirmed); middleware skips `/api` store paths (`middleware.ts:62`). Any authenticated CASHIER reads the full audience including **phone numbers + totalSpend**, while the broadcast *send* route correctly 403s them.

## Fix approach
1. **Params:** route both routes through XC-01 helpers; `gender` validated against the `Gender` enum allowlist (400 on miss); numeric params NaN-guarded (400). Keep out-of-domain-but-numeric behavior as-is (birthdayMonth ignore, big-number safety) to avoid regressing pins.
2. **Permission gate:** require `customer:view` … which CASHIER *has* (OBS-4: cashier may view+create customers by design). So the real question is **broadcast-audience scope**: gate preview/count with `broadcast:send` (the send route's own permission) OR mask `phone`/`totalSpend` for callers lacking it. Recommend: same permission as the send route (`broadcast` family key from `ROLE_PERMISSIONS`), since these endpoints exist to serve the broadcast composer. Decision flagged for the client (req 3.9/3.5 intent = owner/marketer tooling).
3. Align `birthdayMonth` validation with the broadcast endpoint's existing 400 (OBS-5 inconsistency).

## Files
- `src/app/api/customers/preview/route.ts`, `count/route.ts`, `src/lib/api/permission-guard.ts` (XC-03 helper), validators/constants for the enum list.

## Acceptance / gate
- `tests/31` P2/X4 flip: `minSpend=abc` → 400, `gender=💥` → 400; `1e20`/`99` still 200.
- `tests/31` S3 updated to the chosen policy (cashier 403 or masked phone) — currently pins "cashier can read"; flip with the client decision recorded in the PR.
