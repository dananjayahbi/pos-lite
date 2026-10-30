// ── Settings hub catalog (single source of truth) ───────────────────────────
// Backs the `/settings` landing page. Mirrors the sidebar's Settings group, but
// is permission-driven (the sidebar additionally gates some entries by role).
// Every `href` must resolve to an existing `(store)/settings/*` page.

import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';

export interface SettingsCatalogEntry {
  href: string;
  label: string;
  description: string;
  /** Omitted for entries every signed-in store user may open (e.g. My Account). */
  permission?: PermissionKey;
}

export const SETTINGS_CATALOG: SettingsCatalogEntry[] = [
  {
    href: '/settings/store',
    label: 'Store Profile',
    description: 'Business name, logo, contact details and receipt footer.',
    permission: PERMISSIONS.SETTINGS.manageStoreProfile,
  },
  {
    href: '/settings/taxes',
    label: 'Taxes',
    description: 'Store-wide VAT and SSCL rates used when pricing sales.',
    permission: PERMISSIONS.SETTINGS.manageTax,
  },
  {
    href: '/settings/users',
    label: 'Team & Permissions',
    description: 'Staff accounts, roles and per-user permission overrides.',
    permission: PERMISSIONS.SETTINGS.manageUsers,
  },
  {
    href: '/settings/hardware',
    label: 'Hardware',
    description: 'Receipt printers, cash drawers and label devices.',
    permission: PERMISSIONS.SETTINGS.manageHardware,
  },
  {
    href: '/settings/website',
    label: 'Website',
    description: 'Public storefront content, hero slides, navigation and ads.',
    permission: PERMISSIONS.SETTINGS.manageWebsite,
  },
  {
    href: '/settings/webhooks',
    label: 'Webhooks',
    description: 'Outbound endpoints and delivery retry history.',
    permission: PERMISSIONS.SETTINGS.viewWebhookEndpoints,
  },
  {
    href: '/settings/audit-log',
    label: 'Audit Log',
    description: 'Immutable trail of privileged actions, exportable to CSV.',
    permission: PERMISSIONS.SETTINGS.viewAuditLog,
  },
  {
    href: '/settings/account',
    label: 'My Account',
    description: 'Your own profile and password.',
  },
];

/** Settings entries the user may open (no permission ⇒ always visible). */
export function visibleSettingsCatalog(permissions: readonly string[]): SettingsCatalogEntry[] {
  return SETTINGS_CATALOG.filter(
    (entry) => !entry.permission || permissions.includes(entry.permission),
  );
}
