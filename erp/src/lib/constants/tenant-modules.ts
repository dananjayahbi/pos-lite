/**
 * M08-04 (BUG-38) — canonical tenant feature-module registry.
 *
 * Single source of truth for the module names a business can enable, stored
 * in `Tenant.settings.enabledModules`. `feature-guard` reads these keys and
 * the `FeatureModuleToggleSchema` validator accepts only these names, so
 * unknown modules can no longer be written via the superadmin API.
 */
export const TENANT_FEATURE_MODULES = ['appointments', 'delivery', 'website'] as const;
