# M29-01 — BUG-68: cross-tenant IDOR — any authenticated user can edit/DELETE another tenant's hero slides and ads by bare id

**Severity:** P1-Critical (multi-tenant integrity break on the customer-facing storefront) · **Module:** 29 Website CMS · **QA pins:** `tests/29_website_cms.spec.ts` S4, S5, S6 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/lib/services/website.service.ts`: `updateHeroSlide` (88-96) `prisma.websiteHeroSlide.update({ where: { id: slideId } })`; `deleteHeroSlide` (98-100) `delete({ where: { id } })`; `updateAd` (157-173) and `deleteAd` (175-177) — **all four query by bare id, no `tenantId` in the where, and none even accepts a tenantId parameter.**
- Routes `api/store/website/hero-slides/[id]/route.ts` (PATCH 34, DELETE 66) and `ads/[id]/route.ts` (same lines): resolve `session.user.tenantId` only for the 401 check and for `revalidateTenantStorefront(...)` — the mutation gets the bare route id.
- QA reproduced ×3 across two runs: Lanka owner renamed + deleted dilani's slide ("HACKED-BY-LANKA") and patched dilani's ad — all 200.

## Fix approach
1. Change the four service signatures to take `(tenantId, id, …)`; where becomes `{ id, tenantId }` (update/deleteMany/`updateMany`+`deleteMany` or findFirst→404 pattern). 404 NOT_FOUND on miss (matches the app's cross-tenant convention — no existence disclosure).
2. Routes: pass `session.user.tenantId` (already resolved) into the service calls.
3. Apply the same audit to the sibling create paths (`createHeroSlide`/`createAd` connect tenant correctly per QA F4/F7 — verify, don't assume).
4. **This exact bare-id-mutation shape is the pattern to grep for repo-wide** — XC-05/XC-06 should include a sweep (`update({ where: { id } })` without tenantId in service files) since other modules may share the disease silently (QA only probed the ones they tested).

## Files
- `website.service.ts` (4 fns), `hero-slides/[id]/route.ts`, `ads/[id]/route.ts`, repo-wide grep sweep (separate checklist in PR).

## Acceptance / gate
- S4/S5/S6 flip: cross-tenant PATCH/DELETE → 404; same-tenant flows (F4/F5/F7) stay green; revalidation still fires for the owner's tenant.
