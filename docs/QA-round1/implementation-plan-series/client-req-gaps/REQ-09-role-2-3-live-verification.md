# REQ-09 — Req 2.4 Roles 2 & 3: live browser verification of DISPATCH_STAFF and FACTORY_MANAGER surfaces (post BUG-3 / M03-08)

**Severity:** P1 verification gap (the client's core RBAC mapping is only code-verified) · **Type:** client-req gap · **Depends on:** M03-01 (role assignable), M03-08 (known-password seeds), M01-06 (factory prefixes survive the proxy migration), M24/M23 (packaging visibility for dispatch) · **Refs:** req 2.4 Role 2/3 bullets

## Verified source state (2026-09-15)
- `ROLE_PERMISSIONS.DISPATCH_STAFF` (permissions.ts:223, 10 delivery/recovery keys) and `FACTORY_MANAGER` (:235) are correctly scoped; `middleware.ts:26-36,177-185` force-redirects FACTORY_MANAGER off `/pos`, `/sales`, `/returns`, `/reports`, `/customers`, `/expenses`, `/billing`, `/staff`, `/delivery/reconciliation`.
- **Untestable live today:** DISPATCH_STAFF can't be assigned/edited (BUG-3) and no FACTORY_MANAGER/MANAGER/STOCK_CLERK account has a known password (GAP-2/3). QA's dispatch@ayurpos.dev session reaches `/delivery` + is denied staff admin (test 8.4) — that half IS browser-verified.

## Fix approach (a verification plan, executable once dependencies land)
1. After M03-01 + M03-08: seed `factory@ayurpos.dev` (FACTORY_MANAGER), `manager@ayurpos.dev`, `stockclerk@ayurpos.dev` with known passwords (already specified in M03-08 step 4).
2. Extend `tests/03` §2.4 section (or a new `tests/36_rbac_roles.spec.ts`): **Role 2 (DISPATCH_STAFF):** sees POS billing? (client req says "POS Billing, Customer Orders, Packaging Stock visible" — verify against `ROLE_PERMISSIONS.DISPATCH_STAFF` which currently has ONLY delivery/recovery keys → **likely a permission-matrix gap to raise: does dispatch get `sale:create`?** — the code-vs-req mismatch must be resolved with the client, then browser-verified); Orders ✅; Packaging ✅ (via delivery keys); Raw materials ❌ hidden (verify `/factory*` redirects + API 403s); HR ❌ (N/A until REQ-03). **Role 3 (FACTORY_MANAGER):** `/factory` + raw-material + BOM pages 200; the 9 forbidden prefixes redirect; forbidden APIs 403.
3. Record results as evidence lines in `QA_CLIENT_REQ.md` 2.4.

## Acceptance / gate
- New spec green; req 2.4 Role 2/3 bullets ticked with browser evidence (currently `[ ]`/⏸). The dispatch-POS-permission question answered in writing either way.
