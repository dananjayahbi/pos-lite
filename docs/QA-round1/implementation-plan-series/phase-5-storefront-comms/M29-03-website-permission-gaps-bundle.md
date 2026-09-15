# M29-03 — OBS-41: the entire website CMS surface is auth-only (cashier can rewrite the tenant's public site) + req 3.4 announcement top-bar editor gap + OBS-43/44

**Severity:** P2-Major (permission gap) + P3 bundle · **Module:** 29 Website CMS · **QA pins:** S2/S3 (currently pin cashier-access AS current behavior), `tests/29` F11, T4 · **Depends on:** XC-03 (shared guard), M29-01 (same files)

## Verified source state (2026-09-15)
- **OBS-41 holds:** `src/app/(store)/settings/website/page.tsx:10-11` — only `!session?.user?.tenantId → redirect('/login')`. All 7 `api/store/website/*` routes: grep for role/permission/hasPermission → **zero matches**; auth + tenantId-exists only. A CASHIER can read AND write the tenant's full website config (branding, SEO, slides, ads, sections). Contrast `/settings/users` (hard-gated).
- **Req 3.4 announcement top-bar:** no dedicated top-bar editor field exists; closest capability is the section-level JSON `sections` blob (QA X7 verified stored/accepted) — the client asked for "announcement top-bar text/link editor without modifying code".
- **OBS-43:** `PUT /website` validates the whole `heroSlides` array BEFORE the media-less draft filter → one draft with empty `mediaUrl` rejects the entire save (400); the UI must strip empty-media rows client-side (currently does? verify during impl).
- **OBS-44:** `updateAd`/`updateHeroSlide` PATCH path lacks the date `datetime` enforcement POST has (garbage strings → Invalid Date risk; T4 verified no corruption but validation is thinner).

## Fix approach
1. **Permission key:** add `PERMISSIONS.SETTINGS.manageWebsite` (or reuse `settings:manage`-family key if present) in `permissions.ts`; gate the page + all 7 routes via the shared guard (XC-03 helper). Assign to OWNER/MANAGER (+ any marketing role the client names). Flip S2/S3 pins to 403/redirect for CASHIER.
2. **Top-bar editor:** add a dedicated `announcementBar: { text, link, isActive }` field to the WebsiteConfig schema/validator + a small form section in the settings page (new component file `AnnouncementBarSettingsForm.tsx`), rendered by the storefront layout. If the client accepts the sections-blob route instead, document that decision and close req 3.4 bullet as "via sections config".
3. **OBS-43:** move the media-less draft filter BEFORE schema validation of each row (filter per-item, validate survivors), or make `mediaUrl` optional-with-draft-flag in the schema; keep the UI strip behavior either way.
4. **OBS-44:** PATCH date fields get the same `z.coerce.date()`/`.datetime()` treatment as POST.

## Files
- `permissions.ts`, website page + 7 routes, new settings form component, `website.validators.ts`, storefront layout (announcement render), `tests/29` S2/S3/F11/T4.

## Acceptance / gate
- CASHIER: page redirect + routes 403; OWNER/MANAGER unchanged green; announcement editor round-trips text/link/active and renders on the public site; single empty-media draft no longer rejects the whole save (or documented contract); PATCH garbage date → 400.
