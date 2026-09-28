# M30-03 — BUG-72: `InvoicePaymentEvent` audit row written BEFORE the signature gate (forgeable payment ledger)

**Severity:** P2-Major · **Module:** 30 Payments · **QA pin:** `tests/30_payments_billing.spec.ts` A1 (contract pin) · **Depends on:** M30-01 (needs invoices to exist for the write path to trigger), INF-02

## Progress details

Status: **implemented** (uncommitted, branch `QA-R1`) — done together with M30-02 (same file).
See **§ Implementation record** at the bottom of this document for the research findings,
the route's new order of operations, files changed, unit tests and the spec-pin edits.

## Verified source state (2026-09-15) — holds
Order of operations in `src/app/api/webhooks/payhere/route.ts`:
1. parse body (22-33); 2. compute `expectedSig`/`signatureValid` (41-54) — **only a `console.warn` if invalid, no early exit**; 3. look up invoice by `order_id` (57-61); 4. **if the invoice exists, `prisma.invoicePaymentEvent.create(...)` runs immediately (64-79)** storing the forged `payhereMd5sig` + `rawPayload` + `signatureValid:false`; 5. only at 88-91 does `if (!signatureValid) return 200` short-circuit.
- Today the write can't fire (no invoices exist — M30-01), so A1 is a passing contract pin. The moment invoices exist, any attacker who guesses a real invoice id can flood `InvoicePaymentEvent` with unverified rows that persist even though the payment was rejected — corrupting the payment-event ledger and any reconciliation built on it.

## Fix approach
1. **Gate before write:** move the `if (!signatureValid) return 200` check to immediately after signature computation (before the invoice lookup). Unsigned events are then never persisted.
2. If the team wants forensic capture of rejected attempts, do it in a **separate, clearly-untrusted** table/log (Sentry event or a `WebhookRejectedLog` with `verified:false`), never in the financial `InvoicePaymentEvent` ledger.
3. Keep the always-200 response (PayHere retry semantics) — the fix is about the write, not the status.

## Files
- `webhooks/payhere/route.ts` (reorder), optional `WebhookRejectedLog` if capture is wanted.

## Acceptance / gate
- A1 upgraded: once invoices exist, a forged-signature IPN for a real invoice id creates **zero** `InvoicePaymentEvent` rows; a correctly-signed one creates exactly one (idempotent on replay — QA verified replay safety separately).

---

# Implementation record — M30-02 + M30-03 (one coherent change)

Both bugs live in the **same file**, so they were implemented together (the work order was
explicit about this). Everything below is **uncommitted** on branch `QA-R1`.

## 1. Research findings (recorded before the first source edit)

| Area | Verified state |
|---|---|
| Current order of operations (pre-fix) | `src/app/api/webhooks/payhere/route.ts`: **1** parse body → **2** compute `expectedSig`/`signatureValid` + a bare `console.warn` when invalid → **3** `prisma.invoice.findUnique` → **4** `prisma.invoicePaymentEvent.create(...)` **whenever the invoice exists** (storing the forged `payhereMd5sig` and `signatureValid:false`) → **5** only then `if (!signatureValid) return 200`. Confirms BUG-72 exactly as the work order describes. |
| DB reality | Live probe (read-only): `invoices` = **0** rows, `invoice_payment_events` = **0** rows, `subscriptions` = **1** row. So the pre-fix write path is **reachable today** — M30-01 seeded a real subscription, so an attacker who guesses a real invoice id *can* write. |
| Other pre-gate writes | The **recurring** branch (`message_type === 'RECURRING'`) had its **own** `invoicePaymentEvent.create` after the old gate, i.e. a second write site with the identical payload shape. Both had to be covered. |
| Secret | `PAYHERE_MERCHANT_SECRET` is **absent from `erp/.env`** (INF-03 outstanding) — confirmed by a presence-only grep (the value was never read or printed). |
| PayHere algorithm | `md5(merchant_id + order_id + payhere_amount + payhere_currency + md5(secret.toUpperCase()))` — the **inner** hash uppercases the secret; the outer concatenation is not touched. Verified by reading `route.ts:44-54` and re-deriving the hashes with `node:crypto`. |
| Response body | Pre-fix every exit used the literal `NextResponse.json({ received: true }, { status: 200 })`; the body carried **no** signature/verdict information at all. Only `tests/30` asserted `json.received === true`, so rejection fields can be **added** without breaking any caller or assertion. |
| Unit-test convention | Sibling suites live at `src/lib/<domain>/__tests__/<name>.test.ts` (e.g. `src/lib/payments/__tests__/payhere-status.test.ts`, `src/lib/api/__tests__/*.test.ts`) and are picked up by `vitest.config.ts` (`include: ['src/**/*.test.ts']`). |
| Spec mirror | Runner = `erp/tests/30_payments_billing.spec.ts`; `docs/QA-round1/tests/` is frozen. Re-read in full: M30-01 had already flipped F1/F2/F7/A3/R1/X5 and touched S5/L1/A1. |
| Test tooling | `tests/01_auth.spec.ts` and `tests/31_communications.spec.ts` both open a short-lived **`pg`** `Client` from `DATABASE_URL` (dotenv-loaded) inside the spec — so a DB-backed assertion is an established pattern in this suite. `@playwright/test` specs are **excluded** from `tsconfig.json`, so they were type-checked with an explicit `tsc` invocation. |
| Health route | `src/app/api/health/route.ts` reports **only** DB reachability (`status`/`latency`) — there is **no** `integrations.payhere` shape to plug into. The work order's mention of it is aspirational (INF-03). Not touched: adding an integrations block is INF-03's file, not this task's. |

## 2. The route's NEW order of operations

1. `request.text()` → `URLSearchParams`; read `merchant_id`, `order_id`, `payhere_amount`,
   `payhere_currency`, `status_code`, `md5sig`, `recurring`, `message_type`.
2. Redacting `console.log` of the payload.
3. **`verifyPayhereSignature(...)`** (new module) — returns `{ valid, reason }`; the unconfigured
   secret is warned about **rate-limited inside the module**.
4. **`if (!signatureValid)` → structured `console.warn` + `rejected(reason)` and RETURN.**
   This short-circuit is now **immediately after signature computation** — before the invoice
   lookup and before **any** `invoicePaymentEvent.create`. Nothing is read or written.
5. `prisma.invoice.findUnique({ where: { id: order_id }, include: {...} })`.
6. If the invoice exists → `invoicePaymentEvent.create(...)` with `signatureValid: true`.
7. `custom_2 = "order:<deliveryId>"` → `processOrderPaymentStatus` → `accepted()`.
8. `message_type === 'RECURRING' && !invoice` → create the invoice on the fly, write its audit
   event (`signatureValid: true`), `processPaymentStatus(...)` → `accepted()`.
9. `!invoice` → `accepted()`.
10. Duplicate protection: `invoice.status === PAID` → `accepted()`.
11. `processPaymentStatus(...)` → `accepted()`.
12. `catch` → `console.error` + `accepted()` (unhandled errors still never 500, per OBS-47).

All exits go through `accepted()` / `rejected(reason)`, so the always-200 contract and the
`{ received: true }` back-compat shape are enforced from a single place each.

## 3. Files changed

| File | Change |
|---|---|
| `erp/src/lib/billing/payhere-signature.ts` | **NEW.** `verifyPayhereSignature`, `computePayhereSignature`, `getPayhereMerchantSecret`, `warnSecretNotConfigured`, `resetSecretWarningThrottle`, `SECRET_WARNING_THROTTLE_MS`, the `PayhereSignaturePayload`/`PayhereSignatureRejection`/`PayhereSignatureResult` types. Dependency-free (no prisma, no `server-only`) so it runs in the route and in vitest. |
| `erp/src/app/api/webhooks/payhere/route.ts` | Inline `createHash` block removed; gate moved before all DB access; new `accepted()`/`rejected()` helpers; `reason`/`signatureValid` added to the rejection body; both audit writes now record the verified constant. |
| `erp/src/lib/billing/__tests__/payhere-signature.test.ts` | **NEW.** 22 unit tests (see §4). |
| `erp/src/lib/billing/__tests__/payhere-webhook-gate.test.ts` | **NEW.** 5 route-level tests driving the real handler with a mocked Prisma client, proving the gate precedes all DB access (see §4). |
| `erp/tests/30_payments_billing.spec.ts` | A1/S5/L1 pins upgraded + A1b added; every other IPN pin brought onto the new rejection contract (see §5). |
| this file | Implementation record appended. |

## 4. Unit tests

`src/lib/billing/__tests__/payhere-signature.test.ts` — location/naming matched to
`src/lib/payments/__tests__/` and `src/lib/api/__tests__/` (proving `npx vitest run <path>` = **22 passed**):

* correct signature → `{ valid: true, reason: null }`, incl. uppercase-hex tolerance and "no warning when configured";
* wrong signature → `{ valid: false, reason: 'BAD_SIGNATURE' }`, incl. empty sig, a sig computed **without** the `toUpperCase()` step, and a valid sig reused with a different `amount`;
* missing secret → `{ valid: false, reason: 'SECRET_NOT_CONFIGURED' }` for unset / `''` / whitespace-only, incl. that it **takes precedence over** `BAD_SIGNATURE` and that the **empty-secret hash is still rejected** (the gate is never loosened);
* `computePayhereSignature` pinned to literal MD5 vectors computed independently with `node:crypto` (`2dfe5ce49f96deae63b98e66b075af3c` for `qa-secret-abc`, `617fc10a2bb5e206973c8fc3c14ad925` for the no-uppercase variant) + per-field sensitivity;
* `warnSecretNotConfigured` rate-limiting: one log per window, 100 calls → still 1 log, logs again after the window, re-armed by the reset hook.

`src/lib/billing/__tests__/payhere-webhook-gate.test.ts` — 5 tests proving the BUG-72 invariant
**directly on the handler** (mocked `@/lib/prisma`), which the DB-less workflow could otherwise
only assert indirectly:

* forged IPN → `200` + `{ received:false, signatureValid:false, reason:'BAD_SIGNATURE' }` and **`invoice.findUnique` / `invoicePaymentEvent.create` were never called**;
* missing-secret IPN → `SECRET_NOT_CONFIGURED` and again **zero DB calls**;
* the empty-secret hash an unset secret would expect → still `SECRET_NOT_CONFIGURED`, no write;
* **non-vacuity guards:** a verified IPN *does* reach the lookup, and a verified IPN for an existing invoice writes **exactly one** event with `signatureValid: true`.

## 5. Spec-pin edits (old → new)

All in `erp/tests/30_payments_billing.spec.ts` (runnable mirror; frozen `docs/QA-round1/tests/` untouched).
M30-01's subscription-contract flips (F1/F2/F7/A3/R1/X5) were **not** reverted.

**A1 (M30-03)** — was a vacuous unknown-id pin with no DB assertion:
* old: `test('A1 (BUG-72 pin): invalid-signature IPN must NOT create an InvoicePaymentEvent', ...)` / `expect(res.status()).toBe(200);` + `// No crash, no partial state — the route always answers 200.`
* new: `test('A1 (BUG-72/M30-03 pin): a forged-signature IPN for a REAL invoice creates ZERO InvoicePaymentEvent rows', ...)` — injects a run-tagged invoice straight into Postgres (no HTTP surface can create one), POSTs a forged-signature IPN at that **real id**, asserts `expectRejectedIpn(...)` then `expect(await countRunInvoicePaymentEvents(invoiceId), 'BUG-72: ...').toBe(0)`; a second half asserts the **empty-secret** hash is also rejected and still writes 0; a **non-vacuity** self-check inserts a probe row and proves the counter *can* see 1 before trusting the 0; cleanup in `finally`.
* **A1b added**: `test('A1b (BUG-72/M30-03 pin, correctly-signed half): a valid-signature IPN creates EXACTLY ONE InvoicePaymentEvent row', ...)` — asserts the accepted body stays `{ received: true }` (no `reason`) and the count is exactly `1`. **Deliberately `test.skip`ped** while `PAYHERE_MERCHANT_SECRET` is unset (INF-03) — skipped with an explicit reason, never silently passed. Uses `status_code:'0'` (pending) so it exercises the audit write **without** the PAID/ACTIVE transition, keeping F1/A3/R1/X5/S5 green.

**S5 (M30-02)** — was `expect(json.received).toBe(true)` behind a comment about the unset secret:
* old: `expect(json.received).toBe(true);` + `// If PAYHERE_MERCHANT_SECRET is unset, expectedSig is computed from an empty secret — a real deployment risk pinned here.`
* new: `const reason = await expectRejectedIpn(res); expect(reason).toBe(EXPECTED_MISSING_SECRET_REASON);` — plus a second request carrying the **empty-secret hash**, also asserted as `SECRET_NOT_CONFIGURED`; the M30-01 subscription-state half (`dilani.subscriptionStatus !== 'ACTIVE'`) is preserved unchanged.

**L1 (M30-02)** — retitled `'L1 (BUG-71/M30-02 gate pin): invalid-signature IPN is rejected with a reason code, order path never runs'`; `expect(res.status()).toBe(200); expect(json.received).toBe(true);` → `const reason = await expectRejectedIpn(res); expect(reason).toBe(EXPECTED_MISSING_SECRET_REASON);` (the order path is never reached because the gate now precedes it).

**Also brought onto the contract** (they pinned the old always-200 `received:true` body): `P2`, `S4`,
`H1`, `N1`, `X1`, `X2` (adds `expect(text).not.toContain('alert(1)')` — the new body is a fixed
enum and echoes nothing), `X3` (per-code `expectRejectedIpn`), `T2`. `A2` additionally asserts the
**decisive** fields of a replayed rejection are identical (`received:false`, same `reason`).

Header comment rewritten ("Live-environment reality") to describe the post-fix state; fixtures,
login helper, run-tag/self-cleanup style untouched; no Playwright run.

## 6. Verification

* `npx vitest run src/lib/billing/__tests__/` → **2 files / 27 tests passed**.
* `npx vitest run` (whole repo) → **38 files / 308 tests passed** (baseline 37/286 → +1 file / +22 tests; the second new file's 5 tests are included in the 308).
* `npx tsc --noEmit -p tsconfig.json` → **only 2 pre-existing errors**, both `TS2307` for `jspdf`/`jspdf-autotable` in `src/lib/reports/generate-report.ts` (excluded by the work order). Zero errors in touched files.
* Spec type-check: `npx tsc --noEmit --strict ... tests/30_payments_billing.spec.ts` → clean (the spec is excluded from `tsconfig.json`, so it was checked explicitly).
* `npx eslint` on the touched source files → **0 errors** (only pre-existing `no-console` *warnings*, which are `warn` repo-wide and used identically by every logger in `src/lib`).
* Playwright **not** run; no dev server; no `prisma db push`/`generate`; nothing committed.
* A temporary `tsx` probe of the live handler was attempted and **deleted** (it cannot import the route: `payhere.service.ts` is `server-only`, which `tsx` cannot resolve). That dead end is why the handler-level invariant is proven by `payhere-webhook-gate.test.ts` instead.

## 7. NEW issues found but NOT fixed (out of scope)

1. **Replay duplication (idempotency) — contradicts the acceptance note.** A replay of a *valid* signed IPN for an invoice that is still `PENDING` writes **a second** `InvoicePaymentEvent` row; the duplicate guard (`status === PAID`) is checked *after* the audit write and only *suppresses re-processing*, not the audit row. So "a correctly-signed one creates exactly one (idempotent on replay)" holds only when `status_code` is terminal (`2`), which pairs with **A2b** in the frozen spec — and A2b currently pins `recorded.length >= 4` for a 4× replay. Reordering the gate (M30-03) is orthogonal and does not change this, but the doc's acceptance sentence needs an explicit decision. Not fixed: it needs a natural-key/uniqueness decision (schema change) belonging to the webhook-dedup work.
2. **The pre-existing A2b pin is unsatisfiable ~3 min into a suite run.** It requires a `PENDING` invoice and cancels the demo subscription, while `F2/A3/R1/X5` cancel that same subscription (and `A3` *requires* `CANCELLED`), so no IPN can ever be processed later in the file. QA-observed, not introduced here.
3. **`deleteRunInvoice` is no longer safe (my A1 introduces invoices).** It uses the pre-existing `invoice` **relation** `onDelete: Cascade`, so deleting a run invoice also deletes any *real* `PaymentReminder` rows pointing at it (manual SQL can never be mistaken for a client error). It cannot touch `InvoicePaymentEvent` rows (leftover rows on a *deleted* invoice would make A1b's `toBe(1)` fail loudly rather than pass wrongly). A softer cascade-fixture scope is worth considering.
4. **`src/app/api/health/route.ts` has no `integrations.payhere` block** — the work order's "startup/health signal" half of M30-02 has no home yet (INF-03). The rate-limited log + response reason are implemented; health reporting is not.
5. **`prisma.invoicePaymentEvent.create` failures are swallowed** (`catch { console.error }`), so a verified IPN can be processed while its audit row is missing. Pre-existing; worth an explicit decision now that the ledger is trusted.
6. **`erp/.env` still lacks `PAYHERE_MERCHANT_SECRET`**, and there is no `.env.example` entry for it; `PAYHERE_MERCHANT_ID` is also unset. Consequence of INF-03, restated because it is the *whole* reason A1b/S5's positive half stays gated.
