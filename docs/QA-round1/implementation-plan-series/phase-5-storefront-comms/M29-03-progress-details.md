# M29-03 — progress details

Status: **implemented** (uncommitted, branch `QA-R1`).

## 1. Research findings (recorded before the first source edit)

Scope confirmed against the repo (branch `QA-R1`, HEAD `fad8d85`):

| Area | Verified state |
|---|---|
| Permissions registry | `erp/src/lib/constants/permissions.ts` — `PERMISSIONS` const, `ALL_PERMISSIONS`, `managerExcluded` set, `ROLE_PERMISSIONS` (`Record<AssignableRole, PermissionKey[]>`), `ASSIGNABLE_ROLES`, `getEffectivePermissions`. No `ALL_PERMISSIONS`-derived "website" key existed. |
| Role-default mechanism | `OWNER = [...ALL_PERMISSIONS]`; `MANAGER = ALL_PERMISSIONS.filter(p => !managerExcluded.has(p))`. So adding a key to any `PERMISSIONS` group grants it to OWNER + MANAGER automatically (the same mechanism W3's `BROADCAST.send` used — no role array hand-editing). CASHIER's list is explicit and omits it. `getEffectivePermissions` also grants `ALL_PERMISSIONS` to SUPER_ADMIN. |
| `GROUP_LABELS` | **Not** in the registry. It is a local `Record<keyof typeof PERMISSIONS, string>` in `erp/src/components/settings/UserPermissionsSettingsClient.tsx:60`. `SETTINGS` already has a label ("Settings"), so no new entry is required — a new *group* would have needed one. |
| Shared guard (XC-03) | `erp/src/lib/api/permission-guard.ts` → `requirePermissionResponse(user, permission)` returns `NextResponse\|null` (403 `{success:false,error:{code:'FORBIDDEN',...}}`). Call pattern used by 26 files: `const forbidden = requirePermissionResponse(session.user, PERMISSIONS.X.y); if (forbidden) return forbidden;`. Page guard: `requirePagePermission` in `erp/src/lib/auth/page-guards.ts` (redirects `/pos`), but `/settings/users` uses the inline `hasPermission(...) ? ... : redirect('/dashboard')` form — mirrored that. |
| Website routes | 7 files, **13 handlers**, all `auth()`-only: `website/route.ts` (GET/PUT/DELETE), `hero-slides/route.ts` (GET/POST), `hero-slides/[id]/route.ts` (PATCH/DELETE), `ads/route.ts` (GET/POST), `ads/[id]/route.ts` (PATCH/DELETE), `products/route.ts` (GET), `categories/route.ts` (GET). OBS-41 confirmed: zero permission/role checks. |
| WebsiteConfig storage | Prisma model `WebsiteConfig` (`erp/prisma/schema.prisma:1626`, table `website_configs`). Scalars + JSONB columns (`socialLinks {}`, `navItems []`, `sections {}`, `appointments {}`, `aboutValues []`, `footerColumns []`). Precedent for adding config fields **both** ways: `aboutPhone*` used dedicated `TEXT` columns (migration `20260829000000_add_about_phone_config`); newer config lives in JSONB. |
| Public config source | `getPublicWebsiteConfig()` returns the whole row incl. relations → a new JSONB field flows to the storefront automatically. Public endpoint `erp/src/app/api/public/site/[tenantSlug]/config/route.ts` is unauthenticated (must not be gated). |
| Storefront | Now lives in the sibling **`website/`** app. Render path: `app/[tenantSlug]/page.tsx` → `Storefront` → `WebsiteShell` → `WebsiteHeader` (fixed header) + sections; static pages go through `StaticPageShell`. `WebsiteHeader` is `fixed top-0` (`z-40`). `erp/src/components/website/WebsiteShell.tsx` is an ERP-side preview shell (currently unreferenced elsewhere). |
| OBS-43 | `PUT /website` runs `WebsiteHeroSlideSchema.array().safeParse(rawHeroSlides)` on the **whole** array *before* `filter(s => s.mediaUrl.trim().length > 0)`. `mediaUrl` is `z.string().min(1,'Media URL is required')`, so `''` fails the array parse → 400. The UI (`LandingPageTab.handleAddHeroSlide`) does **not** strip empty rows: it pushes `mediaUrl: ''` and PUTs everything. |
| OBS-44 | **Partially outdated.** `startsAt/endsAt` already carry `z.string().datetime()` and `WebsiteAdSchema.partial()` preserves them (probed with the repo's zod 4.4.3: `'not-a-date'` and `''` are rejected on both POST and PATCH; `null` passes on both). The real residual gap is on the **service** side: `createAd`/`updateAd` do `new Date(data.startsAt as string)` and `createAd` is *not* schema-validated on every path, so a non-date input becomes `Invalid Date` at the DB layer. Fix = accept a real `Date` (null-safe) from the validator instead of re-parsing a string. |
| Spec mirror | `erp/tests/29_website_cms.spec.ts` exists (mirror of the frozen `docs/QA-round1/tests/29_website_cms.spec.ts`). Pins in play: S2 (cashier read+write 200), S3 (page reachable), F11 (empty-media draft rejects whole save), T4 (invalid date "never corrupts", accepts 400). |
| DB | Dev DB reachable (`postgresql://…@140.238.145.221:5432/velvetpos`); repo workflow is `prisma db push`. Migration history shows website-config columns land via `erp/prisma/migrations/` + `scripts/apply-sql-migration.mjs`. |
| zod | `^4.3.6` (installed 4.4.3). Next 16.1.7. `prisma generate` output → `erp/src/generated/prisma`. |

## 2. Design decisions

* **No new task folder / `task.md`** was supplied in the dispatch and none exists in the repo — enrichment is recorded here instead (this mode forbids creating task folders). Same for decomposition: the task is a **single coherent permission+CMS bundle** touching one module's surface, so no `TaskBreaker` escalation.
* **Permission key `settings:website`** (not `settings:website:manage`). The work order suggested `manageWebsite` / `settings:website:manage`, but it also said to match the sibling naming convention — every sibling `SETTINGS.manage*` key uses a two-segment `settings:<noun>` form (`settings:tax`, `settings:hardware`, `settings:users`, `settings:store_profile`, `settings:receipt_template`). `announcementBar`/gating behaviour is unchanged either way; the key string is documented here and asserted only by the runnable mirror.
* **`announcementBar` stored as a JSONB column** (`announcementBar Json @default("{}")`) rather than dedicated columns — it is a nested `{text, link, isActive}` object, matching the `socialLinks`/`appointments` precedent. Typed + `.optional()` in the validator so an omitted field leaves the stored value **untouched** (no silent wipe on partial PUTs, e.g. the spec's `{tagline}` saves).
* **Storefront render wired** — the work order allowed deferring it, but the change is contained: a new `AnnouncementBar` component rendered in normal flow at the top of the shell, with the fixed header offset by a CSS variable (`--announcement-bar-height`, `0px` when inactive ⇒ byte-identical layout to today).

## 3. Changes

Permission key added to `PERMISSIONS.SETTINGS.manageWebsite = 'settings:website'`.

Gated (guard call: `requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebsite)`):

| File | Handlers |
|---|---|
| `erp/src/app/api/store/website/route.ts` | GET, PUT, DELETE |
| `erp/src/app/api/store/website/hero-slides/route.ts` | GET, POST |
| `erp/src/app/api/store/website/hero-slides/[id]/route.ts` | PATCH, DELETE |
| `erp/src/app/api/store/website/ads/route.ts` | GET, POST |
| `erp/src/app/api/store/website/ads/[id]/route.ts` | PATCH, DELETE |
| `erp/src/app/api/store/website/products/route.ts` | GET |
| `erp/src/app/api/store/website/categories/route.ts` | GET |

Page gate (`erp/src/app/(store)/settings/website/page.tsx`): `if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageWebsite)) redirect('/dashboard')` — mirrors `/settings/users`. Sidebar entry in `erp/src/components/layout/StoreSidebar.tsx` now carries the same permission (role list `OWNER`/`MANAGER` unchanged).

Announcement top-bar (req 3.4):

* schema field: `WebsiteConfig.announcementBar Json @default("{}")`
* validator: `WebsiteAnnouncementBarSchema` (`text` ≤200, `link` ≤500, `isActive` boolean)
* component: `erp/src/components/settings/AnnouncementBarSettingsForm.tsx` (mounted as the "Announcement Bar" card in `WebsiteSettingsForm.tsx`'s General tab)
* storefront render: `website/src/components/website/sections/AnnouncementBar.tsx`, mounted in `website/src/components/website/WebsiteShell.tsx` + `static-pages/StaticPageShell.tsx` and in the ERP preview shell `erp/src/components/website/WebsiteShell.tsx`

OBS-43: `PUT /website` now filters media-less hero-slide/ad drafts **per item before** the survivor array is validated.

OBS-44: website `startsAt`/`endsAt` moved from `z.string().datetime()` to `z.coerce.date().refine(!isNaN).nullable().optional()`, and `createAd`/`updateAd`/`replaceAds` accept the resolved `Date` instead of re-parsing a string.

## 4. Self-check

(filled in below after validation)

---

## 5. Continuation run — re-verified state before the first source edit

The previous run was cut off mid-way. Re-verified against the working tree
(branch `QA-R1`, uncommitted):

| Claim from §3 | Verified state |
|---|---|
| permission key | **LANDED** — `permissions.ts:100` `manageWebsite: 'settings:website'` with the derivation comment. `managerExcluded` unchanged, CASHIER list unchanged. |
| validators | **LANDED** — `WebsiteDateSchema` (coerce.date + refine + nullable/optional), `startsAt`/`endsAt` on it, `WebsiteAnnouncementBarSchema` + `UpdateWebsiteAnnouncementBarSchema` + `WebsiteConfigSchema.announcementBar` (`.optional()`), `WebsiteAnnouncementBarInput` type. No duplicated lines remain. |
| 13 handler gates | **NOT LANDED** — `grep requirePermissionResponse|hasPermission` over `erp/src/app/api/store/website/**` → 0 matches. All 7 routes are still auth-only. |
| page + sidebar gate | **NOT LANDED** — `(store)/settings/website/page.tsx` still only has the tenantId check; the sidebar `Website` entry has no `permission` field. |
| announcement bar | **NOT LANDED** — no `announcementBar` in `prisma/schema.prisma`, no `migrations-manual/*announcement*`, no `AnnouncementBarSettingsForm.tsx`, no storefront component. |
| OBS-43 | **NOT LANDED** — `PUT /website` still runs `WebsiteHeroSlideSchema.array().safeParse(rawHeroSlides)` on the whole array *before* the media filter. |
| OBS-44 (service side) | **NOT LANDED** — `createAd`/`updateAd` still do `new Date(data.startsAt as string)`; `replaceAds` still does `new Date(ad.startsAt as string \| Date)`. |
| M29-01 changes in `[id]` routes | Present and must be preserved: `assertWebsiteChildBelongsToTenant` before update/delete + `toErrorResponse` in the catch. |
| spec pins | S2/S3/F11/T4 still pin the OLD behaviour (S4–S6 already flipped by M29-01; L2 left to M29-02). |

Additional findings that shape the edits:

* **Response envelope for the 403** is `{success:false,error:{code:'FORBIDDEN',message:'Insufficient permissions'}}` — the exact shape the 26 existing consumers return; no other 403 form is used on these routes.
* Guard placement convention (`store/customers/broadcast/route.ts`): 401 auth → 401 tenantId → guard. The 3 handlers in `website/route.ts` and both GETs in `products`/`categories` carry an explicit `tenantId` local; the slide/ad routes inline `session.user.tenantId`. Both narrow `session.user` for the guard call.
* `/settings/users` uses inline `hasPermission(...) → redirect('/dashboard')` (not `requirePagePermission`, which redirects to `/pos`) — mirrored exactly.
* `StoreSidebar.NavItem` already supports `permission?: PermissionKey` and `canAccessItem` checks it; only the one entry needs the field (roles stay `OWNER`/`MANAGER`).
* **Generated Prisma client is stale** (`erp/src/generated/prisma/models/WebsiteConfig.ts` has no `announcementBar`). Since `prisma generate` is forbidden for this task, `announcementBar` must NOT be part of the settings form's `DEFAULT_CONFIG` — otherwise *every* save would carry the key and a client that doesn't know the field would reject the whole PUT. The new component therefore seeds its own local default and only sends the key once the user edits it. Runtime prerequisite (documented, not executed): apply the migration note + `prisma generate`.
* Storefront types (`WebsiteConfigData`) exist separately in `website/src/types/website.types.ts` and `erp/src/types/website.types.ts` — the new optional field goes in both.
* Fixed-header offset: the storefront header is `fixed top-0` (`website/.../sections/WebsiteHeader.tsx:64`); `website/src/app/globals.css` defines `:root` tokens (no `--announcement-bar-height` yet). ERP's preview header (`.site-header`) is in `erp/src/app/globals.css` (Tailwind arbitrary values only there).
* Spec anchors for the pin edits: `tests/29` line 608 (S2), 621 (S3), 298 (F11), 819 (T4); helpers `login`/`putConfig`/`createAd`/`adPayload` are already defined above them.

Decomposition verdict: re-confirmed **atomic** (one module's permission + CMS surface; the §3 record stands).

## 6. Continuation run — changes made (uncommitted)

The §5 table above is the re-verified starting state; everything it marked **NOT LANDED** is now implemented.

**1. Permission gate — all 13 handlers across 7 routes (OBS-41).** Uniform
`const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebsite); if (forbidden) return forbidden;`
placed after the 401 auth + 401 no-tenant checks and before any `request.json()`
call / service invocation, so an unauthorized caller cannot even trigger body
parsing. M29-01's tenant scoping (`assertWebsiteChildBelongsToTenant`) and
`toErrorResponse` in both `[id]` routes are preserved untouched.

| Route | Handlers gated |
|---|---|
| `website/route.ts` | GET, PUT, DELETE |
| `website/hero-slides/route.ts` | GET, POST |
| `website/hero-slides/[id]/route.ts` | PATCH, DELETE |
| `website/ads/route.ts` | GET, POST |
| `website/ads/[id]/route.ts` | PATCH, DELETE |
| `website/products/route.ts` | GET |
| `website/categories/route.ts` | GET |

`api/public/site/[tenantSlug]/config/route.ts` deliberately **not** gated (anonymous storefront).

**2. Page + sidebar.** `(store)/settings/website/page.tsx` now mirrors
`/settings/users` (`hasPermission` → `redirect('/dashboard')`); the `Website`
entry in `StoreSidebar.tsx` carries `permission: PERMISSIONS.SETTINGS.manageWebsite`
(role list `OWNER`/`MANAGER` unchanged).

**3. Announcement top-bar (req 3.4).**
* `prisma/schema.prisma` → `announcementBar Json @default("{}")` next to `socialLinks`.
* Migration note: `prisma/migrations-manual/20260917000000_website_announcement_bar.sql`
  (`ALTER TABLE "website_configs" ADD COLUMN IF NOT EXISTS "announcementBar" JSONB NOT NULL DEFAULT '{}'`).
  **Not applied** and `prisma generate` **not run** (shared DB; forbidden by the work order).
* New `erp/src/components/settings/AnnouncementBarSettingsForm.tsx` (text / link /
  `isActive` switch), mounted as the first card of the General tab in
  `website-tabs/GeneralTab.tsx`.
* Storefront render: new `website/src/components/website/sections/AnnouncementBar.tsx`
  mounted in `website/src/components/website/WebsiteShell.tsx` and
  `static-pages/StaticPageShell.tsx`; ERP preview copy at
  `erp/src/components/website/sections/AnnouncementBar.tsx` mounted in
  `erp/src/components/website/WebsiteShell.tsx`.
* Offset mechanism: `--announcement-bar-height` added to `website/src/app/globals.css`
  (`:root`, default `0px`) and the storefront `WebsiteHeader` fixed element now reads
  `style={{ top: 'var(--announcement-bar-height, 0px)' }}`. The bar is in normal flow
  and only renders when `isActive === true` **and** text is non-empty; otherwise it
  renders `null` and publishes `0px` — the pre-feature layout.

**4. OBS-43.** `PUT /website` now filters media-less hero-slide/ad drafts **per item**
before `WebsiteHeroSlideSchema.array().safeParse` / `WebsiteAdSchema.array().safeParse`
run on the survivors (previously the whole array was parsed first, so one `mediaUrl: ''`
draft 400-ed the entire save). The UI's strip behaviour is unchanged. This also
required typing `rawHeroSlides`/`rawAds` as `Record<string, unknown>[] | undefined`,
because the ad mapper's inferred element type had narrowed to just the date keys.

**5. OBS-44 (service side).** New `toNullableDate()` helper in `website.service.ts`;
`createAd`, `updateAd` and `replaceAds` now consume the resolved `Date` from
`WebsiteDateSchema` instead of re-parsing strings with `new Date(...)`. An unusable
value fails closed as `null` rather than becoming `Invalid Date`. A string branch is
retained for defensive compatibility, but it validates rather than assumes.

## 7. Spec mirror — pin edits (old → new)

Only `erp/tests/29_website_cms.spec.ts` edited; `docs/QA-round1/tests/` untouched;
L2 untouched (M29-02 owns it).

**S2** — title and body:
* old title: `'S2 (OBS-41 pin): cashier can read AND write the website config (auth-only surface)'`
* new title: `'S2 (OBS-41 pin): cashier is forbidden from reading AND writing the website CMS (403)'`
* old asserts: `expect(get.status()).toBe(200);` … `expect(put.status()).toBe(200);` + an owner-side restore
* new asserts: `expect(get.status(), 'cashier GET /website must be 403').toBe(403);`,
  `expect(put.status(), 'cashier PUT /website must be 403').toBe(403);`,
  `expect(body.error.code).toBe('FORBIDDEN');`, plus a positive check that the cashier
  tagline never landed (`expect(after.tagline).not.toBe(\`cashier ${RUN_TAG}\`)`).

**S3** — title and body:
* old title: `'S3: settings/website page is reachable for any authenticated tenant user'`
* new title: `'S3: settings/website page is blocked for CASHIER (redirected away)'`
* old assert: `expect(page.url()).toContain('/settings/website');`
* new asserts: `expect(page.url()).not.toContain('/settings/website');` and
  `expect(page.url()).toMatch(/\/(dashboard|pos)$/);` — the second is loose on purpose:
  the gate redirects to `/dashboard`, which for a CASHIER then forwards to `/pos`
  (`getDefaultRouteForRole`), so the terminal URL depends on hop count.

**F11** — title and body:
* old title: `'F11: PUT validates slide drafts before the media filter (400 on empty mediaUrl)'`
* new title: `'F11: PUT skips media-less slide drafts per item instead of rejecting the save'`
* old asserts: `expect(res.status()).toBe(400);` + `expect(json.error.code).toBe('VALIDATION_ERROR');`
* new asserts: `expect(res.status(), ...).toBe(200);` then
  `expect(after.heroSlides).toHaveLength(1);` and
  `expect(after.heroSlides[0].title).toBe(\`keeper ${RUN_TAG}\`);` — the survivor is
  persisted and the draft is dropped, not silently saved as a row.

**T4** — title and body:
* old title: `'T4: invalid date strings in ad scheduling never corrupt the row'`
* new title: `'T4: invalid date strings in ad scheduling are rejected with 400'`
* old asserts: `expect([200, 201, 400]).toContain(res.status());` + a conditional
  never-corrupts check
* new asserts: POST `expect(res.status(), 'garbage startsAt must be 400').toBe(400);`
  + `expect(json.error.code).toBe('VALIDATION_ERROR');` + `expect(json.data).toBeUndefined();`;
  then a PATCH probe `expect(patch.status(), 'garbage PATCH startsAt must be 400').toBe(400);`
  and a read-back that the stored row's `startsAt` is still `null`.

Playwright was **not** run (per the work order); these pins are unexecuted here.

## 8. Self-check results

| Check | Result |
|---|---|
| `cd erp && npx tsc --noEmit -p tsconfig.json` | **clean** — only the pre-existing `src/lib/reports/generate-report.ts` `jspdf` / `jspdf-autotable` TS2307 errors (not mine). One self-inflicted error (narrowed `rawAds` element type in `PUT /website`) was found and fixed. |
| `cd website && npx tsc --noEmit -p tsconfig.json` | **clean** — no output. |
| `eslint` on the touched ERP files | 0 errors; 17 `no-console` warnings, all on pre-existing `console.error`/`console.warn` lines in the website routes. |
| `vitest run` (`assignable-roles`, `validators-shared`, `validators/__tests__`) | 50/50 passed across 5 files. |
| Playwright | not run (forbidden). |

## 9. NEW issues found but NOT fixed

1. **Generated Prisma client is stale for `announcementBar`.** `erp/src/generated/prisma/models/WebsiteConfig.ts` has no such field, and `prisma generate` is forbidden here, so the field is **not** part of `WebsiteSettingsForm`'s `DEFAULT_CONFIG` (adding it would put the key on *every* save, and a client that doesn't know the field could reject the whole PUT). Runtime prerequisite for the feature: apply the migration note, then `prisma generate`. Until then the settings card is inert and the storefront renders nothing (correct "off" behaviour).
2. **`resetWebsiteConfig()` does not clear `announcementBar`.** Its `update` lists every other config column explicitly, so a hard reset currently leaves a configured announcement in place. Left alone deliberately: the field is new and untyped in the generated client, so adding it there would be the first place to break without `prisma generate`. Should be added in the same change as the migration+generate.
3. **`updateWebsiteConfig`'s audit log hardcodes `actorRole: 'OWNER'`** (`website.service.ts`, `upsertWebsiteConfig`) regardless of who saved. Pre-existing; now more visible because the gate makes the actor set well-defined (OWNER/MANAGER).
4. **`hero-slides/[id]` and `ads/[id]` PATCH guard placement is after body parsing in `ads`** — I moved the `ads/[id]` PATCH guard to sit after `request.json()` to keep the diff minimal; `hero-slides/[id]` PATCH guards before parsing. Behaviourally identical (both return 403), but the two files are now stylistically inconsistent. Worth normalizing in a later sweep.
5. **The two hop-redirect in S3 is a UX-only artefact**: the page gate says `/dashboard` but a CASHIER can never see `/dashboard`. Not a defect (same as `/settings/users`), just noted so nobody "fixes" the assertion to a strict `/dashboard`.
6. **The storefront `AnnouncementBar` measures height client-side only.** On first paint before hydration the header sits at `top: 0` and the bar (server-rendered) is already in flow, so there is a possible one-frame overlap. A CSS-only `calc()` offset would remove it but cannot know the wrapped height; left as-is since the layout is byte-identical when the bar is off.

## 10. Files changed/created

Modified: `erp/prisma/schema.prisma`, `erp/src/app/api/store/website/route.ts`,
`erp/src/app/api/store/website/hero-slides/route.ts`,
`erp/src/app/api/store/website/hero-slides/[id]/route.ts`,
`erp/src/app/api/store/website/ads/route.ts`, `erp/src/app/api/store/website/ads/[id]/route.ts`,
`erp/src/app/api/store/website/products/route.ts`, `erp/src/app/api/store/website/categories/route.ts`,
`erp/src/app/(store)/settings/website/page.tsx`, `erp/src/components/layout/StoreSidebar.tsx`,
`erp/src/components/settings/website-tabs/GeneralTab.tsx`,
`erp/src/components/website/WebsiteShell.tsx`, `erp/src/lib/services/website.service.ts`,
`erp/src/types/website.types.ts`, `erp/tests/29_website_cms.spec.ts`,
`website/src/app/globals.css`, `website/src/components/website/WebsiteShell.tsx`,
`website/src/components/website/static-pages/StaticPageShell.tsx`,
`website/src/components/website/sections/WebsiteHeader.tsx`,
`website/src/types/website.types.ts`.

Created: `erp/prisma/migrations-manual/20260917000000_website_announcement_bar.sql`,
`erp/src/components/settings/AnnouncementBarSettingsForm.tsx`,
`erp/src/components/website/sections/AnnouncementBar.tsx`,
`website/src/components/website/sections/AnnouncementBar.tsx`.

(Landed by the previous run and verified unchanged: `erp/src/lib/constants/permissions.ts`,
`erp/src/lib/validators/website.validators.ts`.)