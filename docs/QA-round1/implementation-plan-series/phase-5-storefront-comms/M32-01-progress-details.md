# M32-01 — progress details

Status: **implemented** (uncommitted, branch `QA-R1`). Work order: `M32-01-notifications-page-overflow.md`.

> Dispatch note: **no workflow folder / `task.md` / `breakdown-context.md` / scenario skill root was
> supplied** for this batch, and none exists in the repo (same situation recorded by M29-01/M29-03/M30-01).
> Per TaskExecutor's "never create task folders" rule the enrichment is recorded **here** instead.
> Decomposition was therefore assessed against the repo itself + the work-order docs (verdict: `atomic` —
> see §2).

## 1. Research findings (recorded before the first source edit)

| Area | Verified state (branch `QA-R1`) |
|---|---|
| The route as the doc describes it | **Doc is outdated on the mechanism.** `src/app/api/notifications/route.ts:28-29` no longer uses raw `parseInt` — it already calls `parseQueryInt(searchParams,'limit',{default:10,min:1,max:50})` / `parseQueryInt(searchParams,'page',{default:1,min:1,max:1_000_000})`, with an inline XC-01 comment. So the *literal* BUG-75 repro on this route was already closed by a **route-level** `max` clamp. |
| But the class bug is real and unfixed | `parseQueryInt` only range-clamps when a caller declares `min`/`max`. Probe: `Number('99999999999999999999') === 1e20` and `Number.isSafeInteger(1e20) === false`. Every consumer that omits a `max` still receives a **non-safe integer**. Verified by grep: `parsePagination.page` (`{default:1,min:1}` — no max), and the page params of `batches`, `bom`, `bom/production`, `raw-materials`, `website/products`, `stock-control/movements`, `staff/commissions/payouts`, `low-stock`, plus scalars `activeDays` (`contact-export`, `{min:1}`), `birthdayMonth` (customers preview/count, **no opts at all**), `quantity` (`bom/produce`, **no opts**). |
| Residual 500 surface that the helper actually closes | `store/customer-pricing-rules/route.ts:153` and `store/stock-control/movements/route.ts:168` compute `skip: (page - 1) * limit` from `parsePagination`/no-max page → `1e20 * 20` is unsafe → Prisma rejects → 500. Both page params **do** declare `default: 1` (movements) / via `parsePagination` (rules), which is what makes the "clamp to the declared default" branch (§2) the correct fix rather than `MAX_SAFE_INTEGER`. |
| `reports/stock-movements` | `src/app/api/reports/stock-movements/route.ts:34` still uses raw `parseInt(url.searchParams.get('page') ?? '1', 10)` → **un-migrated XC-01 debt**, untouched by this task (report-only, §6). |
| `parseQueryInt` regex behaviour | `/^-?\d+$/` → `'1e20'` is **malformed → 400** (unchanged, and `parseQueryInt`'s unit test does not currently pin it). `'99999999999999999999'` passes the regex, so the only reachable non-safe case is "|n| > MAX_SAFE_INTEGER" — no separate non-integer branch is needed. |
| `parseQueryNumber` | Already rejects non-finite (`:53-55`) — **verified, no change needed there** — but it does **not** guard magnitude: `'99999999999999999999'` → `1e20` passes as a finite value. |
| Cross-spec pins that constrain the fix | `tests/31_communications.spec.ts:322,683` pin `minSpend=99999999999999999999` → **200** ("bigint-overflow minSpend is a valid Decimal filter"). Therefore `parseQueryNumber` must **never** start 400-ing huge values — saturate only. `tests/34_reports_analytics.spec.ts:639` (`limit=…`) and `tests/35_audit_health.spec.ts:675` (`page=…`) assert only `200`/`not 500`. `tests/03_rbac_users.spec.ts:1174`'s giant literal is a *body* commission rate — unrelated. |
| Existing unit pin to preserve | `query-params.test.ts:50-52` already pins `page=99999999999999999999` **with `{min:1,max:1_000_000}` → `1_000_000`**. The fix must keep the caller-declared `max` winning over any fallback. |
| `parseQueryBool` / `parseQueryDate` | No numeric path; nothing to harden (dates already 400 on `Invalid Date`). |
| Spec mirror | `erp/tests/32_notifications.spec.ts` differs from the frozen `docs/QA-round1/tests/32_notifications.spec.ts` only by the P3 + X3 marker edits (M32-02's §5 has the quoted diff). Frozen copy untouched. **X3 already asserts 200** in the runnable mirror, so this task must strengthen evidence, not flip a pin. |
| tsc baseline | `npx tsc --noEmit` → exactly 2 errors, both the acceptable pre-existing `src/lib/reports/generate-report.ts(7,23)/(8,23)` jspdf TS2307 pair. |
| `server-only` / module conventions | `lib/api/query-params.ts` starts with `import 'server-only'`; `vitest.config.ts` aliases `server-only` to a stub, so the unit test keeps working. Path alias is `@/* → ./src/*`. |

## 2. Design decisions

* **Fix lives in the shared helper** (`src/lib/api/query-params.ts`), per the work order — one guard protects every consumer, so no per-route patch is needed (and the notifications route needs **no** code change: its declared `max: 1_000_000` already wins).
* **Saturation precedence: caller bound → param default → ±`MAX_SAFE_INTEGER`.** The work order states "clamp to `opts.max` (or the default) rather than 400" and, for a missing `max`, `Number.MAX_SAFE_INTEGER`. The precedence chain honours both readings and is the only one that actually protects the downstream multiplication: all skip-computing page params declare `default: 1`, so an overflowing `page` degrades to page 1 (`skip = 0`, safe) exactly as the M32-01 doc recommends ("out-of-domain page → clamp to 1 … extend the same philosophy to overflow"). A bare `MAX_SAFE_INTEGER` fallback would have left `skip = (MAX_SAFE_INTEGER-1) * limit` unsafe.
* **Direction-aware** (`max`/`default` for a positive overflow, `min`/`default` for a negative one) so the pre-existing min/max clamp still sees the right sign — a hugely negative `page` still lands on `min: 1`, never on a positive bound.
* **Never a 400** for a numeric overflow: preserves the documented "valid but out-of-range → clamped" contract and keeps the feed readable.
* **A caller-declared bound is only trusted when it is itself safe** (`Number.isSafeInteger(opts.max)`) — otherwise a pathological `readonly number` could reintroduce the unsafe value.

## 3. Changes

### `erp/src/lib/api/query-params.ts` (the XC-01 class fix)
* **New private `saturateOverflow(value, opts)`** — direction-aware saturation with the precedence
  `caller bound in the offending direction` → `opts.default` → `±MAX_SAFE_INTEGER`, and it only trusts a
  declared bound that is itself a safe integer.
* `parseQueryInt` — `const n = Number.isSafeInteger(parsed) ? parsed : saturateOverflow(parsed, opts);`
  inserted **before** the existing min/max clamp, so the clamp still sees the right sign.
* `parseQueryNumber` — `Math.abs(parsed) > Number.MAX_SAFE_INTEGER` → saturate (the finite check stays,
  and it now has a comment explaining why it uses `Math.abs` rather than `isSafeInteger`: decimals are the
  whole point of that parser). Comment records that a 400 here is *forbidden* by the `tests/31` pin.
* No other behaviour touched: the regexes, the 400 messages, the date/bool parsers and the `parsePagination`
  defaults are unchanged.

### `erp/src/lib/api/__tests__/query-params.test.ts`
* New cases: overflow → declared `max`; overflow with no `max` → `default`; neither → `±MAX_SAFE_INTEGER`;
  negative overflow takes the `min` direction; every saturated value asserted `Number.isSafeInteger`; and a
  guard that malformed values (`'1e20'`, `'99999999999999999999x'`) still 400 rather than saturating.
* `parseQueryNumber`: `'1e999'` still 400; `'99999999999999999999'` saturates to `MAX_SAFE_INTEGER` (and
  `'-…'` to `0` via `min: 0`); sub-threshold decimals keep full precision (`0.0000001`).
* `parsePagination`: an overflowing page yields `{page: 1}` with `(page-1)*limit === 0`.

### `erp/tests/32_notifications.spec.ts` (X3 — runnable mirror only)
X3 was already flipped to 200 by the earlier XC-01 work; it is now **strengthened** to pin the contract
rather than the status code (see the quoted diff in M32-02 §5): `meta.page === 1_000_000` (the route's own
bound), an empty feed, `hasMore === false`, `Number.isSafeInteger((page-1)*limit)`, the huge-*negative* case
→ page 1, and the legacy `includeRead=true` path also clamping. `docs/QA-round1/tests/` untouched.

### Routes that benefit (no per-route edit needed)
The guard is in the shared parser, so every consumer inherits it. Concrete classes:

| Class | Consumers | Why they were exposed |
|---|---|---|
| **Skip/offset overflow (the 500 class)** | `store/customer-pricing-rules` (`parsePagination` → `skip`), `store/stock-control/movements` (`skip`), `api/notifications` (skip), `store/customers` / `store/suppliers` / `store/expenses` / `store/purchase-orders` / `store/staff/[id]/commissions` / `store/timeclock` / `audit-logs` (page→prisma `skip`/services) | page param had no `max`, or only a service-side page |
| **Scale-into-Date overflow** | `store/customers/contact-export` (`activeDays` → `now - activeDays*86400000`) | `{min:1}` only — `1e20 * 86400000` is a nonsense `Date` |
| **Unclamped integer scalars** | `customers/preview` + `customers/count` (`birthdayMonth`, no opts), `store/bom/produce` (`quantity`, no opts) | no options at all → previously an arbitrary `1e20` reached the filter |
| **Money filters** | `customers/preview`/`count` + `store/customers` (`spendMin`/`spendMax`) | `parseQueryNumber` had no magnitude guard |
| **Page-in-meta only (no arithmetic)** | `store/batches`, `store/bom`, `store/bom/production`, `store/raw-materials`, `store/website/products`, `store/staff/commissions/payouts`, `store/stock-control/low-stock` | returned/forwarded a non-safe integer |

## 4. Verification

* `npx tsc --noEmit -p tsconfig.json` → **exactly the 2 accepted pre-existing errors**
  (`src/lib/reports/generate-report.ts(7,23)` / `(8,23)` jspdf TS2307). Zero errors in anything touched.
* `npx vitest run` → **42 files / 345 tests passed** (incl. the 16-test `query-params` suite).
* `node scripts/check-query-params.mjs` (the XC-01 CI guard) → exit 0.
* `npx eslint` on every touched file → **0 errors** (only the module's pre-existing `no-console` warnings,
  see M32-02 §6).
* Not a Playwright run: the X3 pin is verified by the unit-level proof plus the unchanged route logic —
  `parseQueryInt` now cannot return a non-safe integer, so `skip` cannot be unsafe.

## 5. Definition-of-done notes

* **Done-when criteria** — the work-order gate (X3 → 200, never 500; pagination/clamp pins unchanged) is met
  at the unit level and the route level; the live-env X3 execution is left for the Playwright run (this task
  is explicitly not allowed to launch it).
* **Decomposition** — verdict `atomic`. The change is one coherent edit to one shared helper plus its unit
  test; the only judgment call (saturation precedence) is resolved in §2, so there is no internal decision
  point that would change what the rest of the work is. No `TaskBreaker` escalation was available or needed:
  no scenario skill root was forwarded and no workflow folder exists (see the dispatch note at the top).
* **Warnings** — one `no-console` warning sits in `read-all`'s existing catch; it is module convention (141
  API routes do the same) and was already there before this task, so it was neither added nor suppressed.