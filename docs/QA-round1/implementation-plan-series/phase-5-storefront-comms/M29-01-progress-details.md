# M29-01 — progress details

Status: **implemented** (uncommitted, branch `QA-R1`). Work order: `M29-01-website-idor.md`.

## 1. Research findings (recorded before the first source edit)

Verified against the repo, not taken from the work order:

| Area | Verified state |
|---|---|
| The four mutation fns | `website.service.ts` `updateHeroSlide` (88) / `deleteHeroSlide` (98) / `updateAd` (157) / `deleteAd` (175) — none took a `tenantId`; `update`/`delete` matched on the bare route id. Work-order line numbers were pre-M29-03 edits; the **shape** still held. |
| Call sites | Only two route files import them: `hero-slides/[id]/route.ts` (PATCH:34, DELETE:67) and `ads/[id]/route.ts` (PATCH:34, DELETE:67). Repo-wide grep for `lib/services/website.service` → 6 importers; no other consumer of the four fns, so the signature change is contained. |
| Tenant already resolved | Both routes already resolve `session.user.tenantId` (401 guard + `revalidateTenantStorefront`), so no new auth work was needed. |
| Models carry `tenantId` | `schema.prisma:1713` `WebsiteHeroSlide.tenantId`, `WebsiteAd.tenantId` — both indexed (`@@index([tenantId])`), so scoping is cheap and needs no migration. |
| Error convention | `lib/api/errors.ts` → `new ApiError(status, code, message, details?)`; `ApiError.notFound(msg)` also exists. `lib/api/error-envelope.ts` → `toErrorResponse(error, label)` returns a thrown `ApiError`'s own status/code first. Existing service precedent: `staff.service.ts:60` `throw new ApiError(404, 'NOT_FOUND', 'Staff member not found')`. The two `[id]` routes were **not** using `toErrorResponse` (raw 500 catch), so a thrown 404 would have surfaced as 500 — the mapper had to be wired in. |
| Sibling `reorderHeroSlides(slides)` | Takes client-supplied `{id, sortOrder}[]` and `update({ where: { id } })` per item. **Zero call sites** anywhere in the repo (grep `reorder` in `erp/src` → none) — latent, same disease, fixed for symmetry. |
| `replaceHeroSlides(configId, tenantId, slides)` / `replaceAds` | `deleteMany({ where: { configId } })`. `configId` is *not* client-supplied (it comes from `getWebsiteConfig(session.user.tenantId)` in `website/route.ts:151,154`), so **not exploitable today**; tightened anyway (defence in depth). |
| Sibling create paths (work-order step 3) | `createHeroSlide`/`createAd` take `(tenantId, configId, data)` and both routes pass `session.user.tenantId` + `existingConfig.id` (tenant-scoped). Verified **tenant comes from the session, never the body**; zod payload schemas are plain `z.object` (no `tenantId`/`configId` keys) and Prisma drops unknown keys, so no mass-assignment of the owner either. Work-order F4/F7 confirmed. |
| Spec mirror | `erp/tests/29_website_cms.spec.ts` exists and differs from the frozen `docs/QA-round1/tests/29_website_cms.spec.ts` only by two pre-existing QA harness fixes (`clearCookies()` in `login`, `json?.data ?? []` at L429). Not re-copied. Pins S4/S5/S6 sat at `if (status === 200) throw …; expect([403, 404]).toContain(status())`. |

## 2. Changes

### `erp/src/lib/services/website.service.ts`
* **New exported helper `assertWebsiteChildBelongsToTenant(tenantId, 'heroSlide' | 'ad', id)`** — `findFirst({ where: { id, tenantId }, select: { id: true } })`, else `throw new ApiError(404, 'NOT_FOUND', …)`. Fails closed as **404, never 403**, so a foreign id is indistinguishable from a missing one (matches `staff.service.ts` / `assertCustomerBelongsToTenant`). Lives in the service module (not a monolith) per the modularity constraint.
* Signatures: `updateHeroSlide(tenantId, slideId, data)`, `deleteHeroSlide(tenantId, slideId)`, `updateAd(tenantId, adId, data)`, `deleteAd(tenantId, adId)` — each calls the helper before the `update`/`delete`.
* `reorderHeroSlides(tenantId, slides)` — proves the whole id set belongs to the tenant (`length !== new Set(ids).size` → 404) before the transaction.
* `replaceHeroSlides` / `replaceAds` — `deleteMany({ where: { configId, tenantId } })`.

### `erp/src/app/api/store/website/hero-slides/[id]/route.ts` and `…/ads/[id]/route.ts`
* Pass `session.user.tenantId` into the four calls.
* Catch block → `toErrorResponse(error, '<METHOD> <path>')` instead of a hardcoded 500 envelope (the 404 only reaches the client through this mapper). Unhandled errors are still logged by `toErrorResponse`; the 404 is no longer logged as an error.
* `revalidateTenantStorefront(session.user.tenantId, { config: true })` is untouched and still fires **only on success**.

### `erp/tests/29_website_cms.spec.ts` (runnable mirror, the only editable spec location)
* Header contract comment updated; S4/S5/S6 flipped from "cross-tenant write succeeds (200)" to `→ 404`.

## 3. Repo-wide sweep (report only — nothing fixed out of scope)

Method: scratch AST-ish script over `erp/src/lib/services/**` (brace-matched `where` blocks, so multi-line `where` is caught) — a mutation is reported when its `where` contains a bare `id` and **no** `tenantId`, and its enclosing function neither takes nor mentions a tenant. Scratch files deleted after the run.

* **Category A — risky (no tenant anywhere in the fn): 0 hits.**
* **Category B — bare-id mutation, but the enclosing fn mentions `tenantId`: 13 hits, all reviewed, none exploitable:**
  * `appointment-reminder.service.ts:115,121,128` — `processPendingReminders()`, a cron sweep; ids come from its own query.
  * `commission.service.ts:207` — `updateMany` already filtered by `input.tenantId` when the records were read.
  * `inventory.service.ts:354` — `updateStockTakeItem` (see NEW issues).
  * `order-payment.service.ts:104` — `processOrderPaymentStatus` (see NEW issues).
  * `reconciliation-dispute.service.ts:48,93,103` — `findFirst({ id, tenantId })` guard precedes each write.
  * `reconciliation.service.ts:302,328` — `settleEntry`, reached from a tenant-scoped match.
  * `shipment.service.ts:76,87` — `updateShipmentStatus`, ids come from our own DB row (carrier webhook).
* **Category C — 65 hits where the fn does take `tenantId`**; spot-checked `product.service.ts:399` (guards `existing.tenantId !== tenantId`), `customer.service.ts:117`, `supplier.service.ts:133`, `petty-cash.service.ts` (`findFirst({id, tenantId})` before each write) — all already scoped.

Raw `grep` for the literal one-liner shapes (`update({ where: { id:` / `delete({ where: { id:`) matches the same set; the only genuine offenders were `website.service.ts:93,99,170,176`, now fixed.

## 4. Verification

* `npx tsc --noEmit -p tsconfig.json` — **5 errors, all pre-existing and not mine**:
  * `src/lib/reports/generate-report.ts(7,23)`, `(8,23)` — missing `jspdf` / `jspdf-autotable` (called out in the work order as not mine).
  * `src/lib/validators/website.validators.ts(305,3)` TS1117 duplicate key, `(359,13)`/`(362,13)` TS2300 duplicate `WebsiteAnnouncementBarInput` — introduced by the **M29-03** work already uncommitted in this tree (that file is `M`, not touched by this task). See NEW issues.
  * Zero errors in the three files this task changed; VS Code diagnostics for all four touched files report none.
* `npx eslint` on the three changed source files — 0 errors. 4 × `no-console` warnings, all **pre-existing** `console.warn` lines in the revalidation catches (console statements per file went 4 → 2, since the 500-envelope `console.error` was replaced by the shared mapper). No warning added, none suppressed.
* No unit tests cover `website.service.ts` (no `__tests__` file for it). Playwright **not run** per the dispatch; S4/S5/S6 and the same-tenant F4/F5/F7 flows need a live run to confirm.

## 5. New issues found but NOT fixed

1. **`erp/src/lib/validators/website.validators.ts` is currently broken** — `WebsiteConfigSchema` declares `announcementBar` twice (L~298 and L~305; the first is silently swallowed by the second) and `WebsiteAnnouncementBarInput` is declared twice (L359/L362). Three hard TS errors. Came with the M29-03 changes already in this tree, **not from this task**; owner should fix (M29-03's task).
2. **`updateStockTakeItem(sessionId, itemId, counted)` (`inventory.service.ts:325`) is the same IDOR shape**: it checks `item.sessionId !== sessionId` but the *session* is fetched by bare id with no tenant comparison, and the fn takes no `tenantId`. It currently has **no caller anywhere in `erp/src`** (dead code), so it is latent, not exploitable — but if it is ever wired to a route param it is a cross-tenant write.
3. **`processOrderPaymentStatus(deliveryId, statusCode)` (`order-payment.service.ts:72`)** resolves the delivery by bare id from the PayHere IPN's `custom_2` and never asserts it belongs to the tenant the payment claims — it only reads `tenantId` to set Sentry context. The value is signature-protected by PayHere, so I rate it not directly forgeable; worth a second pair of eyes under XC-06.
4. **`getHeroSlides(configId)` (`website.service.ts:67`)** has no tenant predicate — the same bare-foreign-key shape. Not reachable from a route today (`getWebsiteConfig(tenantId)` → `configId` of the caller's own tenant) and it now has **zero callers at all**, so left alone.
5. **`erp/tests/29_website_cms.spec.ts` L429** reads `json?.data ?? []` where the frozen `docs/QA-round1/tests/` copy reads `json?.data?.data ?? []`. One of the two does not match the endpoint's real envelope; pre-existing mirror divergence, deliberately not touched (out of this task's pinned scope).
6. **`reorderHeroSlides` now requires `tenantId` but still has no route** — it is unreferenced. Either wire it (with the tenant from the session) or delete it; left in place, scoped.
7. **TOCTOU note (accepted)**: the scoped guard reads then writes by bare id. A *concurrent* write changing a slide's `tenantId` between the two would defeat it, but no code path can change `tenantId` on these rows, so the window is not realisable today. Not worth a transaction for this fix.