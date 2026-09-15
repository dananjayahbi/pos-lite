# M08-04 — BUG-38: feature-module toggle accepts arbitrary module names, stored verbatim

**Severity:** P3-Minor (config pollution / spoofed-gate risk) · **Module:** 08 Super Admin · **QA pin:** `tests/08_superadmin_tenants.spec.ts` X4 · **Depends on:** nothing

## Verified source state (2026-09-15) — holds, with a correction to the QA note
- `src/lib/validators/appointment.validators.ts:137-139` — `FeatureModuleToggleSchema = z.object({ modules: z.array(z.string()) })`. **No allowlist** — `["hacked-module"]` accepted (200) and stored verbatim into `Tenant.settings.enabledModules` (`feature-modules/route.ts:41,59`).
- **Correction:** QA said "each ≥1 char" (implying a `min(1)`); there is **no length constraint at all** — even `[""]` (empty strings) and `[]` pass. The gap is wider than reported.
- The gate (`src/lib/feature-guard.ts`) only reads known keys (`appointments`/`delivery`/`website`), so unknown names are inert-but-stored — pollution, not privilege.

## Fix approach
1. Define a canonical module registry — reuse the keys `feature-guard.ts` actually checks (appointments, delivery, website; export a `TENANT_FEATURE_MODULES` const from `src/lib/constants/`).
2. `FeatureModuleToggleSchema.modules: z.array(z.enum(TENANT_FEATURE_MODULES)).max(…)` — unknown name → 400; empty array allowed (means "no modules"); dedupe on transform.
3. Route stays the same otherwise (findUnique→404 for unknown tenant is already correct).

## Files
- `src/lib/validators/appointment.validators.ts` (or a shared tenant-settings validators file), `src/lib/constants/` (module list), `feature-modules/route.ts` (import list if needed).

## Acceptance / gate
- `tests/08` X4 flips: `["hacked-module"]` → 400; valid toggles (F6) + live `/appointments` gate effect stay green; `[]` clears modules.
