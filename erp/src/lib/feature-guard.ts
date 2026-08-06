/**
 * Feature Module Guard
 * 
 * Since there is no dedicated feature-flag table, we store enabled modules
 * in Tenant.settings.enabledModules as a string[].
 */

const KNOWN_MODULES = ['appointments'] as const;
export type ModuleName = (typeof KNOWN_MODULES)[number];

/**
 * Check whether a specific feature module is enabled for a tenant.
 * Reads from the tenant's settings JSON blob.
 */
export function isModuleEnabled(
  settings: Record<string, unknown> | null | undefined,
  module: ModuleName,
): boolean {
  if (!settings) return false;
  const enabledModules: string[] = Array.isArray((settings as Record<string, unknown>).enabledModules)
    ? ((settings as Record<string, unknown>).enabledModules as string[])
    : [];
  return enabledModules.includes(module);
}

/**
 * Get all enabled modules for a tenant (for display).
 */
export function getEnabledModules(
  settings: Record<string, unknown> | null | undefined,
): string[] {
  if (!settings) return [];
  const enabledModules = (settings as Record<string, unknown>)?.enabledModules;
  return Array.isArray(enabledModules) ? (enabledModules as string[]) : [];
}

/**
 * Available module definitions for the superadmin feature toggle UI.
 */
export const MODULE_DEFINITIONS: {
  name: ModuleName;
  label: string;
  description: string;
}[] = [
  {
    name: 'appointments',
    label: 'Appointments',
    description: 'Enable appointment scheduling, staff calendar, and booking management',
  },
];
