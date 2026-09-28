# M08-02 — BUG-36: suspend/reactivate/grace-period on unknown tenant id → unhandled 500

**Severity:** P3-Minor (typed-error hygiene) · **Module:** 08 Super Admin · **QA pin:** `tests/08_superadmin_tenants.spec.ts` X5 · **Depends on:** INF-02 (P2025→404 mapper)

## Verified source state (2026-09-15) — still holds
- `src/app/api/superadmin/tenants/[id]/suspend/route.ts:18-22` — `await prisma.tenant.update({where:{id},data:{status:'SUSPENDED'}})` — **no try/catch, no existence check**. Bad id → `P2025` throws → 500 empty body.
- `.../reactivate/route.ts:18-21` and `.../grace-period/route.ts:22-25` — same bare-update pattern.
- **Contrast (correct siblings):** `.../settings/route.ts:44-53` and `.../feature-modules/route.ts:29-35` both `findUnique` → 404 "Business/Tenant not found", wrapped in try/catch. Same resource family, two behaviors.

## Fix approach
1. Route all three through INF-02's `map-prisma-error` (`P2025` → 404 NOT_FOUND) + a top-level try/catch, matching the settings-route shape.
2. Prefer explicit `findUnique` → 404 before the update (consistent with the sibling routes' message text "Business not found"), so the friendly message comes from the service, not the mapper.
3. Keep the 200 responses + audit/notification side-effects identical (QA B1/F5 depend on them).

## Files
- `src/app/api/superadmin/tenants/[id]/suspend/route.ts`, `reactivate/route.ts`, `grace-period/route.ts`.

## Acceptance / gate
- `tests/08` X5 flips: unknown-id suspend/reactivate/grace → 404 (not 500). Happy-path lifecycle (F5) unchanged.
