# M32-02 — progress details

Status: **implemented** (uncommitted, branch `QA-R1`). Work order: `M32-02-notifications-residue.md`.

> Dispatch note: **no workflow folder / `task.md` / `breakdown-context.md` / scenario skill root was
> supplied** for this batch (same situation recorded by M29-01/M29-03/M30-01). Enrichment is recorded
> here instead of in a (`forbidden`) new task folder.

## 1. Research findings (recorded before the first source edit)

| Area | Verified state (branch `QA-R1`) |
|---|---|
| **OBS-59 — the enum is 21 values, not 20** | `erp/prisma/schema.prisma:137-158` `enum NotificationType` → LOW_STOCK_ALERT, STOCK_TAKE_SUBMITTED, STOCK_TAKE_APPROVED, STOCK_TAKE_REJECTED, SYSTEM_ALERT, SALE_COMPLETED, RETURN_PROCESSED, SHIFT_CLOSED, DELIVERY_STATUS_UPDATED, DELIVERY_FAILED, DELIVERY_DISPATCHED, DELIVERY_DELIVERED, PACKAGING_LOW_STOCK, RECONCILIATION_DISCREPANCY, DELIVERY_HELD_EXPIRING, COD_PENDING_ALERT, RAW_MATERIAL_LOW_STOCK, RAW_MATERIAL_CRITICAL, BATCH_EXPIRY_SOON, BATCH_EXPIRED, PETTY_CASH_LOW = **21**. Generated mirror `src/generated/prisma/enums.ts:167-190` matches. |
| **OBS-59 — the gap is bigger than described, and duplicated** | `src/app/(store)/notifications/page.tsx:24` `TYPE_ICONS` = **6** entries (plain `as const`, fallback `?? Info` at :173). `src/components/notifications/NotificationPopover.tsx:41` `TYPE_ICONS: Record<string, typeof Bell>` = **9** entries (fallback `?? Info` at :144) — the two maps have already **drifted** (popover knows SALE_COMPLETED/RETURN_PROCESSED/SHIFT_CLOSED, the page does not). Missing from both: 11 delivery/packaging/reconciliation/COD/raw-material/batch types. |
| **OBS-59 — icon availability must be checked, not assumed** | lucide-react **0.577.0** (`dist/lucide-react.d.ts`). Verified present: `OctagonAlert`, `Siren`, `PackageMinus`, `PackageSearch`, `PackageX`, `PackageCheck`, `Boxes`, `FlaskConical`, `TestTubes`, `ShieldAlert`, `CalendarClock`, `CalendarX2`, `Hourglass`, `Scale`, `Banknote`, `Send`, `Truck`, `ShoppingCart`, `RotateCcw`, `Clock`, `Wallet`, `ClipboardList`. **Absent (must not be used): `AlertOctagon`, `TruckIcon`.** `AlertTriangle` / `CheckCircle2` / `XCircle` are deprecated aliases that still resolve (they compile in both components today) and are kept for byte-identical rendering. |
| **OBS-59 — modularity home** | Direct precedent for a shared icon map in its own module: `src/lib/constants/product-options.ts` exports `PRODUCT_FORM_ICONS: Record<ProductFormValue, LucideIcon>` consumed by `VariantsTab` + `VariantSelectionModal`. New module `src/lib/constants/notification-types.ts` mirrors it, so neither component grows a block. |
| **OBS-59 — typing the enum without bundling Prisma** | `NotificationType` is exported from `@/generated/prisma/client`. A **value** import would drag the Prisma runtime into a `'use client'` bundle; a **type-only** import does not. Precedent: `src/app/(store)/orders/OrdersPageClient.tsx:23` and `.../delivery/packaging/PackagingPageClient.tsx:10` use exactly this `import type { DeliveryStatus } from '@/generated/prisma/client'` in client components. `Record<NotificationType, LucideIcon>` then makes tsc fail if a 22nd enum value is ever added. |
| **OBS-61 — current shape** | `src/app/api/notifications/read-all/route.ts` → one `prisma.notificationRecord.updateMany({ where: { tenantId, recipientId, isRead: false }, data: { isRead: true } })` then `{ success: true, data: { count: result.count } }`. Index `@@index([tenantId, recipientId, isRead])` (`schema.prisma:1039`) is exactly the filter, so a chunked re-select is covered by the same index. |
| **OBS-61 — count semantics to preserve** | `tests/32` pins: `F10` `json.data.count === before` (exact) + `after === 0`; `A3` a second call → `count: 0`; `S4` cashier → `count: 0`. So the chunked implementation must return the **sum of the per-chunk `updateMany` counts**, and the response shape must not change. Chunk = 500 (work order's suggestion). |
| **OBS-60 — no unread API today** | `src/app/api/notifications/[id]/read/route.ts` is the template: `auth()` → `tenantId` → `findFirst({ id, tenantId, recipientId: session.user.id })` → 404 `NOT_FOUND` on miss → `update({ where: { id }, data: { isRead: true } })` → `{ success: true, data: updated }`, with a `console.error` + 500 envelope catch. `ls src/app/api/notifications/` → `route.ts`, `read-all/`, `[id]/read/` only; **no `[id]/unread`**. |
| **OBS-60 — spec dependencies on the one-way read-state** | `tests/32` **R2** carries the stale comment "no un-read API" and a workaround, and **T2** has a branch written to cope with a cleared inbox; **F8/F9/R1/S2/S3/T2 all need unread fixtures**. Adding the route is purely additive — no pin asserts its absence. The runnable mirror is mine to update (frozen copy untouched). |
| **OBS-57 — the gate is `proxy.ts`, not `middleware.ts`** | `erp/src/middleware.ts` **does not exist**; M01-06 renamed it to `src/proxy.ts` (Next 16 convention). `PUBLIC_PATH_PREFIXES` (`proxy.ts:~73`) contains `/login`, `/api/auth/`, `/api/webhooks/`, `/api/public/`, `/status`, `/api/health`, `/site`, `/_next`, `/fonts`, `/icons`, `/images`, … and **not** `/notifications`, so the client page is fully middleware-gated. `tests/32` **S5** already pins the redirect to `/login?callbackUrl=…`. Confirms the work order: documentation only, and any change here would be security-sensitive. |
| **OBS-58 — per-role targeting is producer-driven** | All producers use the same shape: resolve a tenant-scoped recipient list, then fan out. E.g. `shifts/[id]/close/route.ts:86-102` builds `recipients` (tenant-scoped `user.findMany`) and `createMany({ data: recipients.map(r => ({ tenantId, recipientId: r.id, type: 'SHIFT_CLOSED', … })) })`; same pattern in `stock-takes/*/approve|complete|reject`, `sales/route.ts:163`, and 8+ services (`batchAlert`, `rawMaterialAlert`, `packaging`, `petty-cash`, `delivery*`). So "all rows target the owner" is a **fixture** property, not a routing defect. |
| Test surface | `erp/tests/32_notifications.spec.ts` is the runnable mirror and this batch's exclusive file; `docs/QA-round1/tests/` is frozen. Playwright is serial (`playwright.config.ts`: `workers: 1`, spec order guaranteed) — required for the §0 fixture discovery → §11 read-all-last ordering. |
| tsc baseline | 2 pre-existing accepted errors (jspdf pair in `src/lib/reports/generate-report.ts`). |

## 2. Design decisions

* **OBS-59** — one new module `src/lib/constants/notification-types.ts` owning `NOTIFICATION_TYPE_ICONS`
  (all 21 types), `DEFAULT_NOTIFICATION_ICON` and `getNotificationIcon(type)`; both components drop their
  local maps and call the accessor. Fixes the drift AND gives compile-time exhaustiveness.
* **OBS-61** — new module `src/lib/notifications/read-all.ts` (+ `read-all-config.ts`) exporting
  `READ_ALL_CHUNK_SIZE = 500` and `markAllNotificationsRead(tenantId, recipientId)`. Chunk = re-select ≤500
  unread ids → `updateMany({ where: { id: { in: chunk }, tenantId, recipientId, isRead: false } })`.
  **No transaction**: one big `$transaction` would re-create the long lock the batching exists to avoid.
  Termination is driven by the empty re-select, so a chunk reporting `count: 0` cannot abandon rows.
  The route keeps its exact response shape and 500 catch.
* **OBS-60** — new `[id]/unread` route written as a **faithful mirror** of `[id]/read` (same guard order,
  same 404 shape, same envelope) rather than extracting a shared helper: the explicit instruction is
  "mirror … exactly", and the two files are ~40 lines each, so a shared abstraction would add indirection
  for no gain. No UI button added (out of the work order's scope — see §6).
* **OBS-57/58** — documentation comments only (`proxy.ts` gate assumption in the page header; recipient
  targeting note in the shared constants module). **No middleware change**, per the work order.

## 3. Changes

### OBS-59 — icon coverage (all 21 types) + the drift fix

**NEW `erp/src/lib/constants/notification-types.ts`** — the single icon source:
`NOTIFICATION_TYPE_ICONS: Record<NotificationType, LucideIcon>` (21/21), `DEFAULT_NOTIFICATION_ICON`,
`getNotificationIcon(type)` (keeps the old `?? Info` fallback). Typed against the enum with a **type-only**
import, so a future 22nd value fails `tsc` here instead of silently degrading. Module mirrors the existing
`lib/constants/product-options.ts` `PRODUCT_FORM_ICONS` precedent. The OBS-58 note lives here too.

| Prisma `NotificationType` | Icon |
|---|---|
| LOW_STOCK_ALERT | AlertTriangle |
| STOCK_TAKE_SUBMITTED | ClipboardList |
| STOCK_TAKE_APPROVED | CheckCircle2 |
| STOCK_TAKE_REJECTED | XCircle |
| SYSTEM_ALERT | Info |
| SALE_COMPLETED | ShoppingCart |
| RETURN_PROCESSED | RotateCcw |
| SHIFT_CLOSED | Clock |
| PETTY_CASH_LOW | Wallet |
| COD_PENDING_ALERT | Banknote |
| DELIVERY_STATUS_UPDATED | Truck |
| DELIVERY_FAILED | PackageX |
| DELIVERY_DISPATCHED | Send |
| DELIVERY_DELIVERED | PackageCheck |
| DELIVERY_HELD_EXPIRING | Hourglass |
| PACKAGING_LOW_STOCK | PackageMinus |
| RECONCILIATION_DISCREPANCY | Scale |
| RAW_MATERIAL_LOW_STOCK | Boxes |
| RAW_MATERIAL_CRITICAL | ShieldAlert |
| BATCH_EXPIRY_SOON | CalendarClock |
| BATCH_EXPIRED | CalendarX2 |

Every icon was verified to exist in the installed lucide-react 0.577.0 (`AlertTriangle`/`CheckCircle2`/
`XCircle` are deprecated-but-live aliases; they were kept because both components already render them —
swapping to the modern names would have been an unrelated visual churn). The three candidate names that
**do not exist** in 0.577 (`AlertOctagon`, `TruckIcon`) were avoided.

* `src/app/(store)/notifications/page.tsx` — local 6-entry map deleted; 8 now-unused icon imports removed;
  call site → `getNotificationIcon(notification.type)`. Also carries the OBS-57 gate assumption comment
  (`src/proxy.ts`, not `middleware.ts`).
* `src/components/notifications/NotificationPopover.tsx` — drifted 9-entry map deleted; 8 unused imports
  removed; call site → `getNotificationIcon(n.type)`.

Verified exhaustively by script: **21 enum values, 21 map keys, no missing, no extra, no duplicates**, 21
distinct icons, and a `tsc` probe compiling all three alias imports.

### OBS-61 — batched `read-all`

* **NEW `erp/src/lib/notifications/read-all-config.ts`** — `READ_ALL_CHUNK_SIZE = 500`.
* **NEW `erp/src/lib/notifications/read-all.ts`** — `markAllNotificationsRead(tenantId, recipientId)`:
  loop { select ≤500 unread ids → `updateMany({ where: { id: { in: chunk }, tenantId, recipientId,
  isRead: false }, data: { isRead: true } })` → add `result.count` } until the select is empty.
  **No `$transaction`** — one transaction across the sweep would recreate the long lock the batching exists
  to avoid.
* `src/app/api/notifications/read-all/route.ts` — uses the helper; response shape unchanged
  (`{ success: true, data: { count } }`), 401/500 branches untouched.
* **NEW `erp/src/lib/notifications/__tests__/read-all.test.ts`** — 5 tests over a mocked Prisma table:
  chunk sizes `[500, 500, 200]` for 1200 rows (3 statements, not 1); exact summed count; the
  tenant+recipient+unread scope on **both** statements; another recipient's rows untouched (the S4 contract);
  an already-read inbox is a zero-count no-op that issues **no** write (A3); and a `count: 0` chunk does not
  terminate the sweep early.

### OBS-60 — `PATCH /api/notifications/[id]/unread`

**NEW `erp/src/app/api/notifications/[id]/unread/route.ts`** — a faithful structural mirror of
`[id]/read/route.ts`: `auth()` → 401; `tenantId` → 401; `findFirst({ id, tenantId, recipientId: session.user.id })`
→ 404 `NOT_FOUND`; `update({ where: { id }, data: { isRead: false } })` → `{ success: true, data: updated }`;
`console.error` + 500 envelope on throw. Deliberately *not* refactored into a shared helper: the instruction
is to mirror exactly, and a ~40-line symmetry beats an abstraction here.

### OBS-57 / OBS-58 — documentation only

* **OBS-57:** comment in the `/notifications` page header recording that the auth redirect comes from the
  centralized `src/proxy.ts` gate and that `PUBLIC_PATH_PREFIXES` must never be extended to cover this path
  (a client component cannot gate itself; `tests/32` S5 pins the redirect). **No middleware edit.**
* **OBS-58:** comment in `lib/constants/notification-types.ts` recording that per-role targeting is
  producer-driven (each producer resolves a tenant-scoped recipient list and `createMany`s one row per
  recipient), so "all live rows target the owner" is a **seeded-fixture** property, not a routing defect.
  **No behaviour change** — confirming the work order's "documentation only".

## 4. Verification

* `npx tsc --noEmit -p tsconfig.json` → **2 errors, both the accepted pre-existing jspdf pair**; zero in any
  touched file. (A strict-mode slip in the new test file surfaced `TS2532/TS2488` and was fixed before the
  final run — `vitest` alone does not type-check.)
* `npx vitest run` → **42 files / 345 tests passed** (was 41/340: +1 file, +5 tests).
* `npx eslint` on all touched files → **0 errors**. 2 warnings, both the module's pre-existing `no-console`
  in a route `catch` block (`read-all`, and the new mirror matches `[id]/read`'s identical line) — repo
  convention (141 API routes do this), not introduced by this change and not suppressed.
* `node scripts/check-query-params.mjs`/the XC-01 guard → exit 0.
* **Playwright not run** (explicitly out of scope). The `tests/32` edits are therefore type-checked and
  reviewed but not executed here.

## 5. Spec pin edits (old → new, quoted)

The runnable mirror `erp/tests/32_notifications.spec.ts` is the only spec file edited;
`docs/QA-round1/tests/32_notifications.spec.ts` is **frozen and untouched** (verified with `git status`).

**Header contract** — tri-fact correction + the two new API rows:

```diff
- * - API  : PATCH /api/notifications/read-all   (updateMany isRead:false→true; returns count)
+ * - API  : PATCH /api/notifications/[id]/unread (M32-02/OBS-60 — mirror of [id]/read:
+ *                                     recipient+tenant scoped; 404 foreign/unknown;
+ *                                     idempotent isRead=false update; re-seeds fixtures)
+ * - API  : PATCH /api/notifications/read-all   (chunked sweep isRead:false→true,
+ *                                     500 rows/statement (M32-02/OBS-61); returns the
+ *                                     summed count — shape unchanged)

- *   - The suite mutates ONLY the owner's own notification read-state (mark-read /
- *     read-all are reversible-by-nature state transitions, not data destruction).
+ *   - The suite mutates ONLY the owner's own notification read-state. Since
+ *     M32-02/OBS-60 that state is genuinely two-way (mark-read *and* the new
+ *     mark-unread mirror), so a run no longer permanently consumes the unread
+ *     fixture pool the way it did in round 1 (QA used to reset it in the DB).
```

(The `20-value NotificationType enum` line became `21-value … (all 21 now have an icon …)` — the enum is
21, not 20 as OBS-59 states.)

**X3 — the pin is strengthened from "200" to the clamped contract:**

```diff
-  test('X3 (BUG-75 fixed): integer-overflow page param clamps to a safe window', async ({ page }) => {
-    // FIXED (XC-01): page is clamped to [1, 1e6] so skip stays a safe integer —
-    // the overflow page serves an empty 200 instead of crashing Prisma (BUG-75).
-    const res = await page.request.get(`${NOTIFS_URL}?page=99999999999999999999`);
-    expect(res.status(), 'overflow page clamps → 200').toBe(200);
+  test('X3 (BUG-75 fixed): integer-overflow page param clamps to a safe window', async ({ page }) => {
+    // FIXED (XC-01): the shared parseQueryInt now saturates any non-safe integer
+    // BEFORE the range clamp … This route declares `max: 1_000_000` …
+    const res = await page.request.get(`${NOTIFS_URL}?page=99999999999999999999`);
+    expect(res.status(), 'overflow page clamps → 200').toBe(200);
+    const json = await res.json();
+    expect(json.meta.page).toBe(1_000_000);
+    expect(json.data.notifications).toEqual([]);
+    expect(json.meta.hasMore).toBe(false);
+    expect(Number.isSafeInteger((json.meta.page - 1) * json.meta.limit)).toBe(true);
+    const negative = await page.request.get(`${NOTIFS_URL}?page=-99999999999999999999`);
+    expect((await negative.json()).meta.page).toBe(1);
+    const legacy = await page.request.get(`${NOTIFS_URL}?includeRead=true&page=99999999999999999999`);
+    expect(legacy.status()).toBe(200);
```

**NEW F12 — the unread toggle (exact `unreadCount` increment + idempotency + 404):**

```diff
+  test('F12 (OBS-60): mark-unread is the exact inverse of mark-read and restores the fixture', …
+    const before = …unreadCount;
+    const res = await page.request.patch(unreadUrl(firstUnreadId!));
+    expect(res.status()).toBe(200);
+    expect(json.data.id).toBe(firstUnreadId);
+    expect(json.data.isRead).toBe(false);
+    const after = …unreadCount;
+    expect(after).toBe(before + 1);            // exact increment
+    // …row is back in the unread feed (server-side persistence)
+    // second call → 200, isRead false, count stable (idempotent)
+    const missing = await page.request.patch(unreadUrl('cmnonexistent000000000000'));
+    expect(missing.status()).toBe(404);
+    expect((await missing.json()).error.code).toBe('NOT_FOUND');
```

**Recipient/tenant scoping extended to the new route** (S2 cashier, S3 Lanka owner → 404) and **auth** (S1 →
401); **R2** now re-seeds one unread row through the new endpoint after asserting `unreadCount === 0` (its
stale "no un-read API" comment is gone), and **T2**'s comment updated to match; **F10** additionally asserts
the count against the `status=unread` feed total, `Number.isInteger`, `Object.keys(data) === ['count']`, and a
drained `meta.total === 0` — which is what makes the chunk-summing verifiable.

## 6. NEW issues found but NOT fixed (out of task scope)

1. **`read-all` is not transactionally atomic** (pre-existing, now documented in the helper): a `Promise.all`
   of read-all + reads (exactly what `tests/32` R2 does) can observe a partially-swept inbox. Chunking makes the
   window slightly wider. Still strictly better than one table-wide lock for durability, but a per-tenant
   `updatedAt` watermark or a single `UPDATE … WHERE` would give at-most-once semantics.
2. **The unread endpoint has no UI affordance** — `[id]/unread` is API-only. Its stated value is QA
   fixture-reset + Gmail-style UX, so a "Mark unread" button on `/notifications` (and/or a hover action in
   `NotificationPopover`) is the natural follow-up; not added because the work order scoped OBS-60 to the API.
3. **`src/app/api/reports/stock-movements/route.ts:34`** still parses `page` with raw `parseInt` — un-migrated
   XC-01 debt (`skip: (page - 1) * PAGE_SIZE` at :86 without any caller bound). The `check-query-params.mjs`
   blocklist only covers the literal `searchParams` binding, so `url.searchParams` sites like this are invisible
   to the guard. Untouched here (different module's doc owns it).
4. **OBS-59's "20 values" is wrong — the enum has 21.** Any doc/roadmap text repeating 20 should be corrected.
5. **`PATCH /api/notifications/[id]/read` and `[id]/unread` are near-duplicates.** The mirror is deliberate for
   this task, but a shared `setNotificationReadState(id, tenantId, recipientId, isRead)` service would remove the
   duplication in a future refactor.
6. **Icon-map drift was already real** between the page and the popover before this task (6 vs 9 types) — now
   structurally impossible, but it shows the pair needs to stay treated as one surface.

* **OBS-59** — one new module `src/lib/constants/notification-types.ts` owning `NOTIFICATION_TYPE_ICONS` (all 21 types), `DEFAULT_NOTIFICATION_ICON` and `getNotificationIcon(type)`; both components drop their local maps and call the accessor. Fixes the drift AND gives compile-time exhaustiveness.
* **OBS-61** — new module `src/lib/notifications/read-all.ts` exporting `READ_ALL_CHUNK_SIZE = 500` + `markAllNotificationsRead(tenantId, recipientId)`. Chunk = re-select ≤500 unread ids → `updateMany({ where: { id: { in: chunk }, tenantId, recipientId, isRead: false } })`. **No transaction**: one big `$transaction` would re-create the long lock the batching exists to avoid. Termination is provable (each pass either marks ≥1 row read or finds the set empty — the unread set shrinks monotonically). Route keeps its exact response shape and 500 catch.
* **OBS-60** — new `[id]/unread` route written as a **faithful mirror** of `[id]/read` (same guard order, same 404 shape, same envelope) rather than extracting a shared helper: the explicit instruction is "mirror … exactly", and the two files are ~40 lines each, so a shared abstraction would add indirection for no gain. No UI button added (out of the work order's scope — see §6).
* **OBS-57/58** — documentation comments only (`proxy.ts` gate assumption in the page header; recipient-targeting note in the shared constants module). **No middleware change**, per the work order.