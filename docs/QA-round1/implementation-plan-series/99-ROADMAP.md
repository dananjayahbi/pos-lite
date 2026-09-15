# 99 — EXECUTION ROADMAP: QA Round-1 Implementation Plan Series

**Companion to:** `00-OVERVIEW.md` (registry, tracker, coverage map). Every doc id below is defined in the series; this file sequences them and carries the live execution state.
**Model:** execution unit = **wave** (W0–W11). Each wave holds **1–2 sessions** depending on size/complexity; a session never exceeds ~15 micro docs. This file is the agent's control document: read §0 + §2 + your wave card + the ledger at the start of every task; update the ledger as you work.

---

## 0. Agent operating protocol (read at the start of EVERY task, not just every session)

**At task start — in order:**
1. Read this file's §0 (protocol), §2 (hard constraints), your **wave card** (§3), and the **progress ledger** (§4). The ledger tells you what is already DONE/BLOCKED — never redo closed work.
2. Read `00-OVERVIEW.md` §7 (global rules) and §2 (corrections C-1…C-7 — QA-report claims that source verification overturned; they change what "correct" means).
3. Read your assigned micro doc **fully** before touching code. Then re-confirm its file:line anchors against live source — the branch moves and anchors can go stale; if an anchor no longer matches, record that in the doc and adapt, don't blindly "fix".
4. Mark the doc IN_PROGRESS in the §4 ledger (append date + session tag).

**Per doc, in wave order** (the wave card lists docs in execution order; respect it — later docs reuse earlier helpers):
- Implement per the doc's modular fix approach, following the existing folder structure (new modular files over appending to monoliths).
- Gate it: run **only the spec named in the doc** (§6 pin-flip discipline; never the full suite). Flip the doc's defect pins to correct behavior in the same change.
- Mark it: `IMPL` when code lands, `GATE` only when the named spec is green. Update BOTH the §4 ledger here and the `00-OVERVIEW.md` §4 tracker row.
- If the doc needs a client decision (§5 register D1–D16) that is unanswered: stop, mark BLOCKED-D<n>, move to the next unblocked doc in the wave — do not guess policy.
- If the gate can't pass because of another doc's missing change: reorder within the wave, don't dual-edit.
- If you find a NEW issue while working: append it to the doc's report section + the ledger's notes column; surface at session end; do not fix out-of-scope.

**At session end:** update the §4 ledger (doc rows + wave row + a 2–3-line handoff note: what landed, what's next, anything stale). Commit per wave (or per seed.ts-touching doc — see §2.6).

**Session kickoff template** (paste into a fresh agent session):
```
Execute wave W<n> of the QA round-1 plan.
Read docs/QA-round1/implementation-plan-series/99-ROADMAP.md §0, §2, §3 (your wave card), §4 (ledger), §5 (decisions), then 00-OVERVIEW.md §2 and §7.
Work the wave card's docs in listed order; this session covers sessions <1|2> of the wave: <doc ids>.
Follow §0 protocol exactly: ledger updates at start/finish of each doc, named-spec gates only, stop-and-mark on unanswered decisions.
```

---

## 1. The full picture — how this plan is organized

- **Original evidence (frozen, do not edit):** `docs/QA-round1/QA_BUG_REPORT.md` (BUG-1…98), `QA_CLIENT_REQ.md` (client requirement checklist), `QA_ROADMAP.md` (QA's own gating notes), `TEST_CREDENTIALS.md`, and QA's Playwright suites `docs/QA-round1/tests/01…35.spec.ts`. These describe a PAST checkout — where they contradict live source, the plan docs' corrections win (overview §2).
- **Micro docs (the work orders):** one per issue/task, 126 of them, in `prerequisites/` (INF-01…04 shared infra), `phase-1-foundation/`…`phase-6-reporting/` (M01…M35 by module), `cross-cutting/` (XC-01…06 policies/helpers used by many docs), `client-req-gaps/` (REQ-01…12 new capability builds). Each contains: meta (severity, module, QA pin ids, dependencies) → verified source state with file:line → root cause → modular fix approach → files → acceptance/gate. Intentionally NO code — you design the implementation from the approach section.
- **`00-OVERVIEW.md`:** master registry — §2 corrections, §3 every BUG/GAP mapped to its doc(s), §4 per-doc status tracker, §7 global rules. The per-doc status column lives there; this file's §4 ledger is the wave-level roll-up.
- **This file:** sequencing + live state + decisions + discipline. If a plan fact and this file disagree, fix this file (it drifts fastest).
- **Test harness reality (until W0 lands):** `erp/tests/` and `erp/playwright.config.ts` do not exist; `@playwright/test` is not a dependency. QA suites run only after INF-01 relocates them into `erp/tests/`. Until then nothing can be gated — that is why INF-01 is the first doc of the first wave.
- **Status vocabulary:** docs go `DOC` (written, verified) → `IMPL` (code merged) → `GATE` (named spec green, pins flipped). Verification-first docs (M18-01, M23-01, M25-02, M02-04) can also go `CLOSED-SOURCE` (spec green against unfixed code → bug already gone; note it in the doc, update `QA_CLIENT_REQ.md` with a dated line). Gates needing client credentials/keys are `BLOCKED-D1`, never "failed".

---

## 2. Global ordering constraints (hard dependencies)

1. **INF-01 (Playwright harness) runs first, period.** Every `GATE` in the series is "run `tests/NN`". Without the harness there is no verification loop. Also fix GAP-4's stale comment + OBS-1 cashier-dialog note during relocation.
2. **INF-02 (error envelope + Prisma/sentinel mappers) and XC-01 (query-param parser) are shared infrastructure** — build them (small, self-contained) before or alongside their first member docs (M04-01, M05-04). All "500 → 400/409" bug docs consume these.
3. **M01-06 (middleware hardening) precedes M03-03/04 and M08-01** (they change gate *behavior* on top of it).
4. **INF-03 (credentials) is a parallel track owned by ops/client** — it gates M24-01 → M24-02 → M26-01 → REQ-07/08 and M30-02, M31-01. Code work continues; those gates stay ⚠️ BLOCKED, not failed.
5. **XC-04 (sanitization policy) precedes M33-01/M34-02/M27-07-item4**; XC-05 (lifecycle policy) precedes M02-03/M05-03/M06-05/M33-03 final shapes; XC-06's helpers land with the first race doc (M03-06) and are reused by the rest.
6. **Seed edits are serialized** (single file, high conflict risk): M01-07 (repair semantics) → M03-08 (role accounts) → M08-05 (plans) → M24-01 (dev courier account). One PR touching seed.ts at a time.
7. **Verification-first docs** (M18-01, M23-01, M25-02, M02-04) run *before* any assumed fix — they may close bugs for free (C-1/C-2 lesson: the report is evidence of a past checkout, not this one).

## 3. Waves — the execution units

Each wave: ordered doc list (execution order = dependency order), session split, entry conditions, exit gate. "V" = verification-first doc: run its spec BEFORE writing code; green → mark CLOSED-SOURCE and move on.

### W0 — Foundation: harness + shared plumbing + free closes · 1 session · 9 docs
`INF-01 → INF-02 → INF-04 → XC-01 → XC-02 → M18-01(V) → M23-01(V) → M25-02(V) → M02-04(V)`
- Entry: none (first wave; INF-01 unblocks everything else).
- Also: open the INF-03 credentials request with the client (parallel track, §5-D1).
- Exit gate: `erp/tests/` harness green on specs 04 + 06; error-envelope mappers unit-tested; verification four closed or escalated to fix plans (record results — they change later waves per §2.7).

### W1 — Identity spine: auth then staff/RBAC · 2 sessions · 15 docs
- S1 (7): `M01-06 → M01-01 → M01-02 → M01-03 → M01-04 → M01-05 → M01-07` (seed edit #1)
- S2 (8): `M03-01 → M03-02 → M03-03 → M03-04 → M03-05 → M03-06 → M03-07 → M03-08` (seed edit #2)
- Entry: W0 GATE. M01-06 first (everything gate-related builds on it, §2.3). Needs D3 (commission ceiling) before M03-05 or mark BLOCKED-D3.
- Exit gate: tests/01 + tests/03 pins flipped; force-logout + sessionVersion live-verified; cashier login (M01-07) proven with reseed.

### W2 — Tenancy enforcement + product/category masters · 1 session · 11 docs
`M08-01 → M08-02 → M08-03 → M08-04 → M08-05 → M02-01 → M02-02 → M02-03 → M02-05 → M04-01 → M04-02` (M08-05 = seed edit #3)
- Entry: W1 GATE (M08-01 needs hardened middleware). Needs D4 (recreate-after-soft-delete policy) before M02-03.
- Exit gate: tests/08 + tests/02 + tests/04 pins flipped; suspension enforced API-deep, not just pages.

### W3 — Customer/supplier masters + sanitization policy · 1 session · 11 docs
`M05-01 → M05-02 → M05-03 → M05-04 → M05-05 → M06-01 → M06-02 → M06-03 → M06-04 → M06-05 → XC-04`
- Entry: W2 GATE (INF-02 mappers in use). Needs D4 before M05-03, D5 before M06-01, D15 before M05-05.
- Exit gate: tests/05 + tests/06 pins flipped; XC-04 policy written down — it governs M33-01/M34-02/M27-07 later.

### W4 — Stock integrity + manufacturing · 1 session · 12 docs
`M07-01 → M07-02 → M07-03 → M09-01 → M09-02 → M09-03 → M10-01 → M11-01 → M11-02 → M13-01 → M13-02 → M21-01`
- Entry: W3 GATE. Needs D6 before M11-02, D7 before M13-02.
- Exit gate: tests/07/09/10/11/13/21 flips; stock ledger trustworthiness re-proved (adjustments, FIFO, reorder).

### W5 — Transactions: POS, returns, shifts, expenses · 1 session · 13 docs
`M14-01 → M14-02 → M14-03 → M14-04 → M15-01 → M15-02 → M16-01 → M16-02 → M17-01 → M17-02 → M19-01 → M20-01 → M20-02`
- Entry: W4 GATE (POS consumes stock). Needs D2 before M19-01, D14 before M14-04. (M18-01 already resolved in W0.)
- Exit gate: tests/14…20 flips; zero false-success create paths left (every 2xx means a persisted row).

### W6 — Delivery + appointments start · 1 session · 9 docs
`XC-06 → M23-02 → M24-01(code half) → M25-01 → M25-03 → M26-02 → M26-03 → M27-01 → M27-02`
- Entry: W5 GATE. M24-01's live-courier half defers to W10 (D1); code half = error mapping incl. NEW-F `DELIVERY_PAYMENT_NOT_SETTLED`.
- Exit gate: tests/23/25/26 + first two tests/27 pins flipped; rate engine NULLS-first fixed; credential-dependent specs marked BLOCKED-D1 with evidence.

### W7 — Appointments complete + storefront core · 1 session · 10 docs
`M27-03 → M27-04 → M27-05 → M27-06 → M27-07 → M27-08 → M28-01 → M28-02 → M28-03 → M28-04`
- Entry: W6 GATE (transition map + XC-06 helpers reused). Needs D16 before M28-01.
- Exit gate: tests/27 + tests/28 flips incl. IDOR/oversell/orderRef closes; reminder pipeline actually sends or is honestly removed.

### W8 — CMS, billing, notifications · 1 session · 9 docs
`M29-01 → M29-02 → M29-03 → M30-01 → M30-02 → M30-03 → M31-01 → M31-02 → M31-03`
- Entry: W7 GATE. M30-02/M31-01 gates need D1 credentials → code lands, gate BLOCKED-D1.
- Exit gate: tests/29…31 flips; website IDOR closed; trial/webhook accounting correct.

### W9 — Comms, reporting, audit + policy closure · 1 session · 12 docs
`M32-01 → M32-02 → M33-01 → M33-02 → M33-03 → M34-01 → M34-02 → M34-03 → M35-01 → M35-02 → XC-03 → XC-05`
- Entry: W8 GATE. Needs D12 before M34-03; XC-04 (W3) governs M33 items; XC-05 finalizes D4 policy across entities.
- Exit gate: tests/32…35 flips; all gate styles uniform (XC-03); delete/lifecycle semantics documented once (XC-05).

### W10 — Credential-gated completion · ≤1 session · runs when D1 lands (any time after W6)
`M24-01(live) → M24-02 → M26-01 → REQ-07 → REQ-08 → REQ-05 payment leg`
- Entry: INF-03 delivered sandbox courier + PayHere + Resend/WhatsApp keys. Not blocking W1–W9 sign-off (§9-R5).
- Exit gate: previously BLOCKED-D1 gates re-run to GATE.

### W11 — Client-requirement builds · 1–2 sessions per decided scope · as §5 decisions land
`REQ-01 → REQ-06 → REQ-11 → REQ-12 → REQ-04 → REQ-09(D8) → REQ-02(D11) → REQ-03(D9) → REQ-10(D10) → REQ-05(D13)`
- Entry: per-doc decision answered; REQ docs define new specs — author them per the doc's acceptance section before implementing.
- Exit gate: new specs green; `QA_CLIENT_REQ.md` checklist lines updated with dated evidence.

**Doc accounting (verified 2026-09-15 against file inventory — each doc appears in exactly one wave):** W0–W9 = 111 docs (all INF except INF-03, all M except M24-02/M26-01, all XC). W10 = 2 deferred M docs + credentialed REQ legs. W11 = 12 REQ docs. Plus INF-03 (client/ops track, requested in W0). 111 + 2 + 12 + 1 = 126 ✓ (matches `00-OVERVIEW.md` totals).

---

## 4. Progress ledger (LIVE — agents update this; do not edit history, append)

**Wave state** (statuses: PENDING / ACTIVE / DONE / BLOCKED): PENDING at creation — 2026-09-15.

| Wave | Sessions | Docs | Status | Completed | Blocked | Handoff notes (dated) |
|---|---|---|---|---|---|---|
| W0 | 1 | 9 | PENDING | — | — | — |
| W1 | 2 | 15 | PENDING | — | — | — |
| W2 | 1 | 11 | PENDING | — | — | — |
| W3 | 1 | 11 | PENDING | — | — | — |
| W4 | 1 | 12 | PENDING | — | — | — |
| W5 | 1 | 13 | PENDING | — | — | — |
| W6 | 1 | 9 | PENDING | — | — | — |
| W7 | 1 | 10 | PENDING | — | — | — |
| W8 | 1 | 9 | PENDING | — | — | — |
| W9 | 1 | 12 | PENDING | — | — | — |
| W10 | ≤1 | 6 legs | PENDING (D1) | — | — | waiting on INF-03 |
| W11 | 1–2/scope | 12 | PENDING | — | — | decision-dependent |

**Doc-level detail** lives in the `00-OVERVIEW.md` §4 tracker (single source per doc); this ledger is the roll-up + handoff. Keep both in sync each task (§0 protocol step 5).

**INF-03 / D1 credential track (parallel, client-owned):** requested ☐ · courier sandbox ☐ · PayHere ☐ · Resend/WhatsApp ☐ · CRON_SECRET ☐.

---

## 5. Decision register (client must answer; blocks marked docs)

| # | Question | Blocks | Likely source |
|---|---|---|---|
| D1 | Trans Express sandbox creds; PayHere sandbox secret; Resend/WhatsApp creds; CRON_SECRET | M24*, M26-01, M30-02, M31-01, REQ-05/07/08 | INF-03 |
| D2 | Petty-cash overdraft: block / override-approve / allow-and-report | M19-01 | client |
| D3 | Commission rate ceiling (0–100 vs 0–999.99) | M03-05 | client |
| D4 | Recreate-after-soft-delete: names reserved (409) vs free (201) — one policy everywhere | XC-05, M05-03 | client |
| D5 | Supplier name uniqueness | M06-01 | client |
| D6 | Batch FEFO consumption in scope? | M11-02/OBS-83 | client |
| D7 | Stock-take drafts (DRAFT status) needed? | M13-02/OBS-23 | client |
| D8 | Dispatch staff POS access (req 2.4 says yes; permission matrix says no) | REQ-09 | client |
| D9 | HR/Payroll in engagement scope? | REQ-03 | client |
| D10 | SMS vs WhatsApp-as-notification-channel | REQ-10 | client |
| D11 | Multilingual surface scope (storefront vs ERP) | REQ-02 | client |
| D12 | Saved-report sharing: private vs tenant | M34-03 | client |
| D13 | Website checkout: gateway order flow in scope now? | REQ-05 | client |
| D14 | Zero-value Replacement: defective-barcode mandatory? | M14-04 | client |
| D15 | Audience endpoints (preview/count): broadcast-permission gate vs phone masking | M05-05/M31-02 | client |
| D16 | Stock reserve-on-order hold expiry duration | M28-01 | client |

## 6. Pin-flip discipline (how sessions prove work)

1. Each doc lists its pin ids; flipping the assertion to the *correct* behavior is part of the fix PR (spec edits live in `erp/tests/` post-INF-01; `docs/QA-round1/tests/` remains QA's frozen record).
2. Run **only the named spec** per fix (QA-lead directive); a wave-end smoke run may chain that wave's specs serially.
3. Cold `.next` before any evidence run (Module-01 forensics). Watch the login rate budget (10/15min) — reuse `storageState`.
4. A fix whose pin cannot flip without another doc's change → reorder, don't dual-edit.
5. Docs marked **verification** (M18-01, M23-01, M25-02, M02-04 — all in W0): run first; if green, close in `QA_CLIENT_REQ.md` with a dated note; if red, upgrade to a fix plan before code.

## 7. Sign-off ledger (end state per client-req group)

- **Group 1 (base):** 1.1–1.3, 1.5 already ticked; 1.4 → REQ-11+M18-01; 1.6 → REQ-06.
- **Group 2:** 2.1 done (M02-01 closes BUG-1); 2.2 → M14-03; 2.3 → REQ-01; 2.4 → M03-01/08 + REQ-09.
- **Group 3:** 3.1 → M24-01/02 (D1); 3.2 → M28-01…04 + REQ-05 (D13); 3.3 → M27-01…08 + REQ-04; 3.4 → M29-03; 3.5 → M31-01…03 + REQ-10 (D10); 3.6 → REQ-02 (D11); 3.7 → M26-01…03 + REQ-08 (D1); 3.8 → M20-01/02 + REQ-03 (D9); 3.9 done; 3.10 → M23-02, M24-01 (auto-deduct verify), M11-02 (D6); 3.11 → M14-04, M35-02, REQ-07 (D1).
- **Housekeeping:** update `TEST_CREDENTIALS.md` (new role accounts), `QA_CLIENT_REQ.md` evidence lines, and regenerate the disposable mirror per its Provenance section.

## 8. Risk notes

- **R1 — middleware semantics:** M01-06 fail-closed changes may surface latent 500s in the bridge path (NEW-B) — land with the tenant-status 200-shape fix together.
- **R2 — constraint migrations** (XC-06, M05-03, M06-01, M28-02) need duplicate pre-flight on the real DB; write dedupe reports before applying uniques; never auto-delete business data.
- **R3 — seed.ts contention** across four docs — serialize (§2.6): M01-07 (W1) → M03-08 (W1) → M08-05 (W2) → M24-01 dev courier account (W6 or W10).
- **R4 — verification-first closes** could invalidate dependent docs' "still holds" lines (M18-01 style); if a W0 run closes a later doc's bug, mark that doc CLOSED-SOURCE without code and note it in the §4 ledger handoff column.
- **R5 — credential timeline (D1)** is outside engineering control; W10/W11 must not block W1–W9 sign-off — report them as ⚠️ BLOCKED-D1 with INF-03 health evidence.

---

## 9. How to run this plan (operator quick-reference)

1. Open a fresh agent session per wave (or per session within a 2-session wave) using the §0 kickoff template; fill in wave number + doc ids from that wave's card in §3.
2. Waves must run in order W0 → W9. W10 may slot in any time after W6 once D1 credentials arrive. W11 docs run as their decisions (§5) land.
3. Before starting W1–W9, collect the matching §5 decisions from the client (they're listed on each wave card) to avoid mid-session BLOCKED stops.
4. After each wave: spot-check the §4 ledger against `00-OVERVIEW.md` §4 tracker; a wave is DONE only when every doc is GATE, CLOSED-SOURCE, or BLOCKED-with-reason.
5. The agent must never edit `docs/QA-round1/tests/` (QA's frozen record) or the QA evidence files; spec edits happen in `erp/tests/` post-INF-01.
