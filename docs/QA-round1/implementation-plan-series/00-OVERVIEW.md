# 00 — OVERVIEW: QA Round-1 Implementation Plan Series

**Project:** VelvetPOS / Ruhunu Wedagedara (Ayurvedic ERP) — `erp/` app
**Source of findings:** `docs/QA-round1/QA_BUG_REPORT.md` (BUG-1…BUG-98), `QA_CLIENT_REQ.md` (unchecked items), `QA_ROADMAP.md` (gates/dependencies), `TEST_CREDENTIALS.md`, suites in `docs/QA-round1/tests/*.spec.ts`
**Created:** 2026-09-15 · **Branch verified against:** `QA-R1` (== `origin/web-refactor` @ `08dee70`)
**Purpose:** a series of micro implementation-plan documents — one per issue/task — so AI-agent implementation sessions can focus accurately. This file is the master registry and progress tracker.

---

## 1. Method & conventions

1. **One document = one issue/task.** Each doc is self-contained: problem, verified current source state, root cause, modular fix approach, files to change, acceptance criteria, and *which* QA spec to run (never the full suite — the QA team warned a full-suite run takes a very long time; run only the relevant spec).
2. **No code snippets** in plan docs — prose + exact file paths + line anchors only.
3. **Source-verification loop:** before a doc is written, the finding is re-checked against the live source (the QA evidence was captured on a different checkout — `e:\my_github_repos\pos_lite` — and the branch has moved). Each doc carries a **Verified-in-source** line with date and file:line, plus a **Still-holds?** verdict. Findings that changed are corrected, not copied.
4. **Implementation sessions:** execution unit = **wave** (roadmap §3); each wave holds 1–2 sessions of ≤15 micro docs. Ordering, live progress, and agent protocol live in `99-ROADMAP.md` §0–§4.
5. **Statuses:** `PLANNED` (registry row only) → `DOC` (micro doc written) → `IMPL` (code changed) → `GATE` (relevant QA spec re-run green / pin flipped). Tracker column in §5.
6. **Severity scale (QA):** P1-Critical / P2-Major / P3-Minor. Implementation priority also weighs blast radius and dependencies (see roadmap doc when written).

## 2. Important corrections found during source verification (2026-09-15)

These differ from the QA report and every dependent doc must respect them:

| # | QA-era finding | Current-source reality |
|---|---|---|
| C-1 | **BUG-13** — `middleware.ts` never executes under Next 16/Turbopack (P1) | **No longer holds.** `erp/middleware.ts` (309 lines) IS bundled and executed (middleware-manifest + dev log evidence). Next 16 only *deprecates the name* (`proxy.ts` is the new convention). The real defects are the **fail-open gates inside it** (BUG-5 class) and the dual Node/Edge caches. Rename = cleanup item (M01-06). |
| C-2 | **BUG-14/15** — double-click fires two callbacks; 500 renders no error | **Largely fixed already** on this branch (submit disabled via `isSubmitting`; `mapAuthError` fallback exists). Residual: guard is React-state-only (not synchronous ref), no signed-in redirect on `/login` (BUG-17 still open). M01-05 covers the residue only. |
| C-3 | **BUG-35** — "suspension not enforced anywhere" | Partially holds: middleware suspension gate + `/suspended` page DO exist, but the gate **bypasses all `/api/` paths** and fail-opens when the bridge errors; `authorize()` has no tenant-status check; store layout has no page guard. M08-01 rewritten to this reality. |
| C-4 | **BUG-54** — cashier login "unexplained" redirect loop | Root-cause candidates ranked from source: (a) `cashier1` is seeded **only inside `seedDemoSales()`** and the whole function is skipped when the tenant already has ≥20 sales, with `upsert update:{}` never repairing a stale row; (b) in-memory IP rate-limit 10/15min; (c) `__Secure-` cookie-name mismatch behind HTTPS proxy; (d) sessionVersion bumps → `/login?sessionExpired`. M01-07 addresses all four. |
| C-5 | QA suites location | `erp/tests/` and `erp/playwright.config.ts` **do not exist** on this branch; suites live only in `docs/QA-round1/tests/`. `@playwright/test` is not a dependency (Vitest only, ~24 unit files). Every fix gate depends on INF-01 restoring the harness. |
| C-6 | Env config | `erp/.env.local` absent; `erp/.env` exists (git-ignored, NOT committed) but lacks `RESEND_API_KEY`, `PAYHERE_MERCHANT_SECRET`, `CRON_SECRET`, all `WHATSAPP_*`, and courier keys → BUG-60/71/73 gate families persist as config work (INF-03). |
| C-7 | New findings (not in QA report) | **NEW-A:** staff audit writes are fire-and-forget (`void … .catch(() => {})`) — failed audit writes vanish silently. **NEW-B:** `/api/internal/middleware` `checkTenantStatus` returns 400 for missing tenantId → middleware silently skips the suspension check (fail-open amplifier of C-3). **NEW-C:** empty route directory `src/app/api/store/staff/[id]/pin/` (dead scaffold). **NEW-D:** `settings/account` PATCH + `reset-password` bump `sessionVersion` — mechanism exists, which is exactly why BUG-6's missing bump is a one-line-per-call fix. **NEW-E:** login page ignores middleware `callbackUrl` (always role-default route). |

## 3. Coverage guarantee (bug → doc index)

Every BUG/GAP id from `QA_BUG_REPORT.md` maps to at least one doc. Ids **BUG-10, BUG-23, BUG-24, GAP-1** do not produce docs: BUG-10/23/24 are never defined in the report (numbering gaps — verify with QA lead); GAP-1 was closed accepted-by-design (recorded in `M02-05` as a decision record).

| QA id | Doc(s) | | QA id | Doc(s) | | QA id | Doc(s) |
|---|---|---|---|---|---|---|---|
| BUG-1 | M02-01 | | BUG-34 | M06-04 | | BUG-67 | M26-03 |
| BUG-2 | M02-02 | | BUG-35 | M08-01 | | BUG-68 | M29-01 |
| BUG-3 | M03-01 | | BUG-36 | M08-02 | | BUG-69 | M29-02 |
| BUG-4 | M03-02 | | BUG-37 | M08-03 | | BUG-70 | M30-01 |
| BUG-5 | M03-03 | | BUG-38 | M08-04 | | BUG-71 | M30-02 · INF-03 |
| BUG-6 | M03-04 | | BUG-39 | M08-05 | | BUG-72 | M30-03 |
| BUG-7 | M03-05 | | BUG-40 | M09-01 | | BUG-73 | M31-01 · INF-03 |
| BUG-8 | M03-06 | | BUG-41 | M09-02 | | BUG-74 | M05-05 |
| BUG-9 | M03-07 | | BUG-42 | M13-01 | | BUG-75 | M32-01 |
| BUG-11 | M01-01 | | BUG-43 | M13-02 | | BUG-76 | M33-01 · XC-04 |
| BUG-12 | M01-04 | | BUG-44 | M14-01 | | BUG-77 | M34-02 · XC-04 |
| BUG-13 | M01-06 (corrected C-1) | | BUG-45 | M14-02 | | BUG-78 | M34-01 |
| BUG-14 | M01-05 (corrected C-2) | | BUG-46 | M15-01 | | BUG-79 | M35-01 |
| BUG-15 | M01-05 | | BUG-47 | M15-02 | | BUG-80 | M07-01 |
| BUG-16 | M01-02 | | BUG-48 | M16-01 | | BUG-81 | M10-01 |
| BUG-17 | M01-05 | | BUG-49 | M16-02 | | BUG-82 | M10-01 |
| BUG-18 | M01-03 | | BUG-50 | M17-01 | | BUG-83 | M11-01 |
| BUG-19 | M02-02 | | BUG-51 | M17-02 | | BUG-84 | M11-02 |
| BUG-20 | M02-03 · XC-05 | | BUG-52 | M18-01 | | BUG-85 | M27-01 |
| BUG-21 | M04-01 · INF-02 | | BUG-53 | M19-01 | | BUG-86 | M27-02 |
| BUG-22 | M04-02 | | BUG-54 | M01-07 · M20-01 | | BUG-87 | M27-03 |
| BUG-25 | M05-01 | | BUG-55 | M21-01 | | BUG-88 | M27-04 |
| BUG-26 | M05-02 | | BUG-56 | M23-01 | | BUG-89 | M27-07 |
| BUG-27 | M05-03 · XC-06 | | BUG-57 | INF-04 · M23-02 | | BUG-90 | M27-05 |
| BUG-28 | M05-04 · XC-01 | | BUG-58 | M23-02 | | BUG-91 | M27-07 |
| BUG-29 | M05-02 · XC-01 | | BUG-59 | XC-02 | | BUG-92 | M27-06 · XC-06 |
| BUG-30 | M06-01 · XC-06 | | BUG-60 | M24-01 · INF-03 | | BUG-93 | M27-07 · M03-02 |
| BUG-31 | M06-01 · XC-06 | | BUG-61 | M24-02 | | BUG-94 | M27-07 · XC-04 |
| BUG-32 | M06-02 · XC-01 | | BUG-62 | M25-01 | | BUG-95 | M28-03 |
| BUG-33 | M06-03 | | BUG-63 | M25-02 | | BUG-96 | M28-04 |
| | | | BUG-64 | M25-03 · XC-06 | | BUG-97 | M28-01 |
| | | | BUG-65 | M26-01 | | BUG-98 | M28-02 · XC-06 |
| GAP-2/3 | M03-08 | | GAP-4 | XC-05 | | OBS/REQ items | see §4 registry |

## 4. Document registry

Folder legend: `prerequisites/` · `phase-1-foundation/` (M01–M08) · `phase-2-inventory/` (M09–M13) · `phase-3-transactions/` (M14–M20) · `phase-4-manufacturing-delivery/` (M21–M27) · `phase-5-storefront-comms/` (M28–M33) · `phase-6-reporting/` (M34–M35) · `cross-cutting/` (XC) · `client-req-gaps/` (REQ). Status: DOC = written this pass; PLANNED = registry only, doc pending (needs its own source-verification loop).

### prerequisites / environment (INF)
| ID | Title | Sev | Status |
|---|---|---|---|
| INF-01 | Restore Playwright E2E harness (config, deps, spec relocation, env-readiness gates) | P1 enabler | DOC |
| INF-02 | Central API error envelope + Prisma error mapping (kill `message.includes` anti-pattern, stop internals leakage) | P1 | DOC |
| INF-03 | Environment/secrets configuration matrix (Resend, PayHere, CRON_SECRET, WhatsApp, Trans Express, courier) | P1 | DOC |
| INF-04 | Decimal/JSON serialization contract (strings vs numbers, 2-dp) | P2 | DOC |

### M01 — Authentication & Session
| ID | Title | Sev | Status |
|---|---|---|---|
| M01-01 | BUG-11 forgot-password silent email skip + live-token takeover chain | P1 | DOC |
| M01-02 | BUG-16 forgot-password limiter: in-memory, fake 200, no audit | P2 | DOC |
| M01-03 | BUG-18 concurrent forgot-password mints multiple live tokens | P2 | DOC |
| M01-04 | BUG-12 sign-out is audit-blind (LOGOUT never written) | P2 | DOC |
| M01-05 | Login UI residue: BUG-14/15 hardening + BUG-17 signed-in `/login` + NEW-E callbackUrl | P2/P3 | DOC |
| M01-06 | Middleware hardening: `proxy.ts` migration + fail-closed gates (corrected BUG-13, NEW-B) | P1 | DOC |
| M01-07 | BUG-54 cashier login reliability: seed idempotency + lockout + cookie-name diagnosis | P1 | DOC |

### M02 — Products & Variants
| ID | Title | Sev | Status |
|---|---|---|---|
| M02-01 | BUG-1 leftover apparel "Gender" column header | P3 | DOC |
| M02-02 | BUG-2 + BUG-19 false-success product creation (207 ignored; `variants` key silently dropped) | P1 | DOC |
| M02-03 | BUG-20 soft-deleted products unrecoverable (restore path missing) | P2 | DOC |
| M02-04 | GAP-4 duplicate search inputs (STALE — fixed in source) + OBS-1 cashier POS dialog note | P3 | DOC (closed) |
| M02-05 | GAP-1 decision record: dosage handled via Description/Usage (reopen triggers) | — | DOC (record) |

### M03 — RBAC, Users & Permissions
| ID | Title | Sev | Status |
|---|---|---|---|
| M03-01 | BUG-3 DISPATCH_STAFF missing from staff role validator + screen disagreement | P1 | DOC |
| M03-02 | BUG-4 + NEW-A staff audit rows: no actor + fire-and-forget writes | P1 | DOC |
| M03-03 | BUG-5 force-logout fail-open: dual caches + typeof guard | P1 | DOC |
| M03-04 | BUG-6 privilege changes never bump sessionVersion (revocations don't apply) | P1 | DOC |
| M03-05 | BUG-7 commissionRate magnitude unvalidated → 500 | P2 | DOC |
| M03-06 | BUG-8 concurrent staff create → 500 instead of 409 | P2 | DOC |
| M03-07 | BUG-9 SUPER_ADMIN stranded on `/login` by page guard | P3 | DOC |
| M03-08 | GAP-2/GAP-3 staff password lifecycle (set-password/invite + role-verification seeds) | P1 | DOC |

### M04 — Categories & Brands
| ID | Title | Sev | Status |
|---|---|---|---|
| M04-01 | BUG-21 409 leaks raw Prisma/Turbopack internals (module instance of INF-02) | P3 | DOC |
| M04-02 | BUG-22 brand vs category delete-button UX inconsistency | P3 | DOC |

### M05 — Customers CRM
| ID | Title | Sev | Status |
|---|---|---|---|
| M05-01 | BUG-25 empty optional Email blocks UI create | P2 | DOC |
| M05-02 | BUG-26 + BUG-29 birthday empty/invalid handling (wrong 409, internals leak) | P1 | DOC |
| M05-03 | BUG-27 no DB unique on (tenantId, phone) — concurrent duplicates | P2 | DOC |
| M05-04 | BUG-28 malformed numeric query filters → 500 (module instance of XC-01) | P3 | DOC |
| M05-05 | BUG-74 + OBS-5 audience endpoints: NaN/enum params → 500; cashier PII exposure | P2 | DOC |

### M06 — Suppliers
| ID | Title | Sev | Status |
|---|---|---|---|
| M06-01 | BUG-30/31 no duplicate guard on supplier phone/name | P2 | DOC |
| M06-02 | BUG-32 non-numeric page/limit → 500 | P3 | DOC |
| M06-03 | BUG-33 cleared Lead Time blocks submit with raw NaN message | P3 | DOC |
| M06-04 | BUG-34 edit sheet first open blank | P2 | DOC |
| M06-05 | OBS-9/10/11 phone search, unarchive path, archived-row edit policy | P2/P3 | DOC |

### M07 — Settings, Taxes & Hardware
| ID | Title | Sev | Status |
|---|---|---|---|
| M07-01 | BUG-80 hardware routes gate on role denylist, not permissions | P2 | DOC |
| M07-02 | OBS-81 dead nav: `/settings/account` 404 (STALE — page now exists), stub `/settings/store`, orphaned form | P3 | DOC |
| M07-03 | OBS-82 hardware PATCH lacks zod validation (silent coercion) | P3 | DOC |

### M08 — Super Admin / Tenants
| ID | Title | Sev | Status |
|---|---|---|---|
| M08-01 | BUG-35 suspension enforcement gaps (API bypass, fail-open, no login check) — corrected C-3 | P1 | DOC |
| M08-02 | BUG-36 suspend/reactivate/grace unknown id → 500 | P3 | DOC |
| M08-03 | BUG-37 `/api/audit-logs` rejects SUPER_ADMIN (system actor audit-blind) | P2 | DOC |
| M08-04 | BUG-38 feature-modules accepts arbitrary module names | P3 | DOC |
| M08-05 | BUG-39 duplicate plan → empty-body 500 + OBS-12/17 plan seeding & list semantics | P2 | DOC |

### M09–M13 — Inventory control
| ID | Title | Sev | Status |
|---|---|---|---|
| M09-01 | BUG-40 movements ledger date params → 500 | P3 | DOC |
| M09-02 | BUG-41 stock add int4-overflow → 500 (upper-bound guard) | P3 | DOC |
| M09-03 | OBS-18/19/22 scanner-Enter dismiss, zero-delta schema asymmetry, reason-chip semantics | P3 | DOC |
| M10-01 | BUG-81/82 + OBS-78 low-stock threshold validation & countOnly semantics | P3 | DOC |
| M11-01 | BUG-83 expiryStatus post-filter breaks `meta.total` pagination | P2 | DOC |
| M11-02 | BUG-84 batches NaN params → 500 + OBS-83 batch consumption/FEFO scope decision | P2 | DOC |
| M13-01 | BUG-42 stock-take accepts negative counted quantities | P2 | DOC |
| M13-02 | BUG-43 no initiator/approver separation + OBS-23 lifecycle (DRAFT) decision | P2 | DOC |

### M14–M20 — Transactions
| ID | Title | Sev | Status |
|---|---|---|---|
| M14-01 | BUG-44 `NONE` payment accepts non-zero sale | P2 | DOC |
| M14-02 | BUG-45 sales date filters → 500 | P3 | DOC |
| M14-03 | Req 2.2 phone-format validation at POS checkout | P2 | DOC |
| M14-04 | Req 3.11 zero-value reason code + Replacement defective-barcode enforcement | P2 | DOC |
| M15-01 | BUG-46 CustomerPricingRule has model + evaluation but no CRUD API | P2 | DOC |
| M15-02 | BUG-47 promotion value overflow → 500 | P2 | DOC |
| M16-01 | BUG-48 concurrent GRN receipts lack exactly-once contract | P2 | DOC |
| M16-02 | BUG-49 GRN UI cannot capture batch/expiry | P2 | DOC |
| M17-01 | BUG-50 cross-tenant return → 500 (unmapped tenant-mismatch) | P2 | DOC |
| M17-02 | BUG-51 return date filters → 500 | P3 | DOC |
| M18-01 | BUG-52 shift-report empty state + req 1.4 cash over/short — STALE-looking, verification doc | P2→close | DOC |
| M19-01 | BUG-53 petty-cash negative balance policy decision + guard | P2 | DOC |
| M20-01 | BUG-54-dependent: cashier RBAC verification for timeclock/commissions | P1 | DOC |
| M20-02 | Req 3.8 payout creation validation contract | P2 | DOC |

### M21–M27 — Manufacturing & delivery
| ID | Title | Sev | Status |
|---|---|---|---|
| M21-01 | BUG-55 raw-material single GET omits stockStatus metadata | P2 | DOC |
| M23-01 | BUG-56 `/delivery/packaging` page timeout — verification doc (no source defect) | P1→close | DOC |
| M23-02 | BUG-58 packaging list sort order + BUG-57 Decimal serialization consumer note | P3 | DOC |
| M24-01 | BUG-60 (+OBS-32) Trans Express auth failure, error-category mapping, packaging auto-deduct trigger | P1 | DOC |
| M24-02 | BUG-61 tracking auto-sync path (req 3.1) once dispatch works | P2 | DOC |
| M25-01 | BUG-62 city-level zone override unreachable (NULLS FIRST) | P1 | DOC |
| M25-02 | BUG-63 double-click Save Rate Card wipes card to zeros — verification doc (guarded in source) | P1→close | DOC |
| M25-03 | BUG-64 concurrent entries PUT blends matrices (no transaction) | P2 | DOC |
| M26-01 | BUG-65 reconciliation engine unreachable (upstream gate plan) | P1 | DOC |
| M26-02 | BUG-66 dispute sentinels unmapped → 500 + OBS-40 dispute audit actions | P2 | DOC |
| M26-03 | BUG-67 corrupt XLSX → 500 (typed parse failure + FAILED row) | P3 | DOC |
| M27-01 | BUG-85 convert-to-sale always fails (`shiftId:''`) | P1 | PLANNED |
| M27-02 | BUG-86 complete/no-show/convert have no permission gate + OBS-80 time-off gate | P1 | PLANNED |
| M27-03 | BUG-87 reminders route IDOR (no tenant scoping, patient PII) | P1 | PLANNED |
| M27-04 | BUG-88 no appointment status-transition guards + OBS-79 backdate policy | P2 | PLANNED |
| M27-05 | BUG-90 service delete in-use guard + recreate-after-delete 500 | P2 | PLANNED |
| M27-06 | BUG-92 non-atomic staff-overlap guard (double-book race) | P2 | PLANNED |
| M27-07 | BUG-89/91/93/94 appointment validation, ranges, audit actor, hygiene bundle | P3 | PLANNED |
| M27-08 | OBS-77 reminder scheduler dead code (cron wiring + delivery channel) | P2 | PLANNED |

### M28–M33 — Storefront, CMS, payments, comms
| ID | Title | Sev | Status |
|---|---|---|---|
| M28-01 | BUG-97 website checkout never decrements stock / stores no lines (overselling) | P1 | PLANNED |
| M28-02 | BUG-98 orderRef race + non-unique | P2 | PLANNED |
| M28-03 | BUG-95 public products endpoint ignores page param | P2 | PLANNED |
| M28-04 | BUG-96 best-selling sort stub + storefront polish residue | P3 | PLANNED |
| M29-01 | BUG-68 hero-slide/ad cross-tenant IDOR (P1 security) | P1 | DOC |
| M29-02 | BUG-69 CMS picker leaks soft-deleted categories | P2 | DOC |
| M29-03 | OBS-41 website surface unpermissioned + req 3.4 announcement top-bar editor + OBS-43/44 | P2 | DOC |
| M30-01 | BUG-70 no subscription exists (dead provisioning path) + OBS-48 | P1 | DOC |
| M30-02 | BUG-71 PayHere secret unset + webhook observability (OBS-47) | P1 | DOC |
| M30-03 | BUG-72 pre-gate payment-event audit write + OBS-50 invoice PDF naming | P2 | DOC |
| M31-01 | BUG-73 communications providers unconfigured + failure visibility | P1 | DOC |
| M31-02 | OBS-51/52/55 audience PII gating + send-receipt gate + history page guard | P2 | DOC |
| M31-03 | OBS-53/54 broadcast sequential loop timeout risk + cron secret hygiene | P2 | DOC |
| M32-01 | BUG-75 notifications page overflow → 500 | P3 | DOC |
| M32-02 | OBS-57–61 notification center residue (icon coverage, un-read, batched read-all) | P3 | DOC |
| M33-01 | BUG-76 webhook URL stored XSS | P2 | DOC |
| M33-02 | OBS-62/66 webhook auto retry/backoff (TODO in dispatch) + unbounded list | P2 | DOC |
| M33-03 | OBS-63/64/65 hard-delete cascade destroys delivery ledger, signature replay, timeout consistency | P2/P3 | DOC |

### M34–M35 — Reporting & audit
| ID | Title | Sev | Status |
|---|---|---|---|
| M34-01 | BUG-78 saved-report `reportType` open-redirect (allowlist) | P2 | DOC |
| M34-02 | BUG-77 saved-report name hygiene (with XC-04 policy) | P3 | DOC |
| M34-03 | OBS-67/70 server-side report export + saved-report sharing decision | P2 | DOC |
| M35-01 | BUG-79 audit CSV header quoting | P3 | DOC |
| M35-02 | OBS-72/73/75 bridge rows tenantId-null, daily-summary email wiring, UI fetch abort | P2 | DOC |

### Cross-cutting (XC)
| ID | Title | Sev | Status |
|---|---|---|---|
| XC-01 | Query-param validation sweep (shared parser/guard; kills the BUG-28/32/40/45/51/74/75/81/82/84/89/91 family) | P2 | DOC |
| XC-02 | Response-envelope consistency (audit-logs shape BUG-59, OBS-13/46 unauth 401-vs-403 policy) | P2 | DOC |
| XC-03 | Page/API permission-gate consistency (OBS-4/8/41/51/52/80; single guard helper) | P2 | DOC |
| XC-04 | Input sanitization / stored-HTML policy (BUG-76/77/94 family; React escaping vs schema strip) | P2 | DOC |
| XC-05 | Soft-delete / restore / deprovision policy (BUG-20, OBS-10, GAP-4, OBS-45/63) | P2 | DOC |
| XC-06 | DB unique constraints + race-hardening sweep (BUG-8/27/30/31/39/48/64/92/98 + token index) | P1 | DOC |

### Client-requirement gaps (REQ) — unbuilt/partial features from `QA_CLIENT_REQ.md`
| ID | Req | Title | Status |
|---|---|---|---|
| REQ-01 | 2.3 | Custom print invoice/dispatch template + dual barcode (top-right + center label) | DOC |
| REQ-02 | 3.6 | Multilingual support (Sinhala toggle, Tamil provisions) — no implementation exists | DOC |
| REQ-03 | 3.9-HR | HR & Payroll module (NIC/bank/salary, EPF 8/12%, ETF 3%, payslip PDF, bank sheet) — unbuilt; scope decision doc | DOC |
| REQ-04 | 3.3 | Appointment portal gaps: booking confirmation SMS/Email, unified patient history surface | DOC |
| REQ-05 | 3.2 | Storefront cart/checkout UI + payment-gateway end-to-end (Visa/MC/Amex, wallets, LANKAQR, Paid→Ready) | DOC |
| REQ-06 | 1.6 | Mobile/tablet responsive audit across ERP + WhatsApp button integration | DOC |
| REQ-07 | 3.11 | Failed-delivery dashboard (Returned-to-Branch/Delivery-Failed mgmt, redelivery/cancel triggers) + recovery report data | DOC |
| REQ-08 | 3.7 | Pending-COD row-level RED highlighting + dispute E2E (post-BUG-65) | DOC |
| REQ-09 | 2.4 | Role 2 (Dispatch) + Role 3 (Factory Manager) live verification plan (post BUG-3/M03-08) | DOC |
| REQ-10 | 3.5 | SMS gateway (local Sri Lankan) — not implemented; provider decision doc | DOC |
| REQ-11 | 1.4 | Petty-cash In/Out records during active shift (cash over/short covered by M18-01) | DOC |
| REQ-12 | — | Superadmin Export Data / per-tenant Audit Log stub buttons (OBS-15 "Phase 5" promises) | DOC |

### Final
| ID | Title | Status |
|---|---|---|
| 99-ROADMAP | Execution playbook: agent protocol §0, plan map §1, wave cards W0–W11 §3, live progress ledger §4, decisions D1–D16 §5, pin-flip discipline, sign-off ledger, risks, operator quick-reference | DOC |

**Totals (as built):** 128 files = 4 INF + 104 module (M01–M35) + 6 XC + 12 REQ + this overview + roadmap. 126 issue/task docs. All written this session (statuses DOC); every BUG/GAP id from `QA_BUG_REPORT.md` is covered per §3.

## 5. Session plan (writing the docs — this conversation + follow-ups)

| Batch | Docs | Source-verified? |
|---|---|---|
| B1 (this session) | 00-OVERVIEW, INF-01…04, M01-01…07, M03-01…08 | ✅ two Explore passes over auth/session/staff sources (2026-09-15) |
| B2 (this session) | M02-01…05, M04-01…02, M05-01…05, M06-01…05 | ✅ Explore pass 2026-09-15 — all hold except GAP-4 (fixed in source; M02-04 records it) |
| B3 (this session) | M07-01…03, M08-01…05, M09-01…03, M10-01, M11-01…02, M13-01…02, M21-01 | ✅ Explore pass 2026-09-15 — all hold except OBS-81's /settings/account 404 (page now exists) and BUG-38 min(1) claim (no length check at all) |
| B4 (this session) | M14-01…04, M15-01…02, M16-01…02, M17-01…02, M18-01, M19-01, M20-01…02 | ✅ direct source checks 2026-09-15 — BUG-44/45/47/49/50/51/53 hold; sale.service now has zero-value+replacement-order-ref machinery (M14-04 built on it); M18-01 empty-state + over/short rows EXIST in source (verification doc, likely close); timeclock/payout gates exist (M20-01 proof plan) |
| B5 (this session) | M23-01…02, M24-01…02, M25-01…03, M26-01…03 | ✅ Explore pass 2026-09-15 — BUG-62/64/65/66/67 hold; BUG-56 & BUG-63 no source defect (verification docs); NEW-F DELIVERY_PAYMENT_NOT_SETTLED unmapped→500; seed has no CourierAccount |
| B6 (this session) | M27-01…08, M28-01…04 | ✅ Explore pass 2026-09-15 — 12/12 hold (convert shiftId:'' :457; 3 ungated routes; reminders bare-id; no transition map; service delete no guard + P2002→500; overlap TOCTOU; dead reminder pipeline w/ fake SENT; order.service ignores lines[] + client-supplied totals; orderRef count+1; slice-only pagination; best-selling=latest) |
| B7 (this session) | M29-01…03, M30-01…03, M31-01…03, M32-01…02, M33-01…03 | ✅ Explore pass 2026-09-15 — all 10 items hold (website.service 4 bare-id fns; categories no deletedAt; zero permission gates on website routes; createTrialSubscription zero callers; webhook event write at :64-79 pre-gate; broadcast post-loop row; notifications no safe-int; endpoint URL refine https-only; dispatch TODO :4) |
| B8 (this session) | M34-01…03, M35-01…02, XC-01…06 | ✅ Explore pass 2026-09-15 — reportType no allowlist + startsWith('/') passthrough; export client-side only; saved GET userId-scoped; audit CSV quotes header; bridge tenantId??null :75; daily-summary logs SENT on console.log :153-162; AuditLogTable now react-query (no signal — partially stale OBS-75); **XC-01 exact sweep: 30 sites/14 files**; **zero `.strict()` in codebase**; staff [id]/pin/ empty dir confirmed |
| B8 | M34-01…03, M35-01…02, XC-01…06 | needs reports/audit sweep |
| B9 (this session) | REQ-01…12 | ✅ targeted source checks 2026-09-15 — label designer exists (no dual-barcode positions); zero i18n libs; no HR/SMS models; recovery routes + FAILED/RETURNED statuses exist (backend ready); website app has cart+checkout pages + public-API layer; WhatsApp buttons present in website components |
| B10 (this session) | 99-ROADMAP | ✅ written after full sweep |

## 6. Execution grouping (waves)

Superseded by `99-ROADMAP.md` §3 wave cards (W0–W11, 1–2 sessions each, doc lists in execution order) — that is the single source for grouping. This file's §4 tracker holds per-doc status; the roadmap §4 ledger holds the wave-level roll-up and handoff notes. Agent protocol (read at every task start): roadmap §0.

## 7. Global rules for every implementation session

1. **Never run the full Playwright suite** — run only the spec named in the doc (QA lead instruction). Single-file runs ≈ minutes; full matrix ≈ very long.
2. QA suites live in `docs/QA-round1/tests/` until INF-01 relocates them; defect pins assert *current broken behavior* — fixing a bug REQUIRES flipping its pin (each doc lists the pin ids).
3. Follow existing folder structure (`erp/src/app/api/store/...`, `erp/src/lib/services/...`, components modularized per feature folder). New UI = new component files, not appends to monoliths.
4. Multi-tenant: every fix must preserve tenant scoping; cross-tenant behavior is 404 (not 403) per established convention.
5. Money = Decimal, LKR 2-dp, never float arithmetic (INF-04).
6. Error responses = typed envelope from INF-02; never leak Prisma/Turbopack internals.
7. Dev server must start from a **cold `.next`** for any QA evidence run (Module-01 forensics).
8. Sessions: `TEST_CREDENTIALS.md` accounts; watch the 10-fail/15-min login rate limit while testing.
