/**
 * Permission-grid helpers (ARGUS #466).
 *
 * The editor rendered every permission at once (134 checkboxes in 23 groups)
 * with no search, collapse, bulk actions or dirty indicator, and Save was
 * always enabled. These pure helpers keep the filtering/bulk/dirty decisions
 * testable outside React.
 */

export interface PermissionGridGroup {
  group: string;
  label: string;
  permissions: string[];
}

export interface PermissionCounts {
  explicit: number;
  revoked: number;
}

/** Human label from a key: `sale:receipt:reprint` -> `receipt reprint`. */
export function permissionLabel(permission: string): string {
  return permission.split(':').slice(1).join(' ').replace(/_/g, ' ');
}

/** True when the label or the raw key matches the (case-insensitive) query. */
export function matchesPermissionQuery(permission: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return (
    permission.toLowerCase().includes(needle) ||
    permissionLabel(permission).toLowerCase().includes(needle)
  );
}

/** Filter permissions inside each group; groups with no hit disappear. */
export function filterPermissionGroups(
  groups: readonly PermissionGridGroup[],
  query: string,
): PermissionGridGroup[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return groups.map((group) => ({ ...group }));

  return groups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) =>
        matchesPermissionQuery(permission, needle),
      ),
    }))
    .filter((group) => group.permissions.length > 0);
}

/**
 * Add every grantable permission in the group that is not already present.
 * Denied keys are cleared (granting restores the inherited default).
 */
export function grantGroupExtras(input: {
  permissions: readonly string[];
  denied: readonly string[];
  groupPermissions: readonly string[];
  inherited: ReadonlySet<string>;
  grantable: ReadonlySet<string>;
}): { permissions: string[]; denied: string[]; changed: boolean } {
  const permissions = new Set(input.permissions);
  const denied = new Set(input.denied);
  let changed = false;

  for (const permission of input.groupPermissions) {
    if (!input.grantable.has(permission)) continue;
    if (input.inherited.has(permission)) {
      if (denied.delete(permission)) changed = true;
      continue;
    }
    if (!permissions.has(permission)) {
      permissions.add(permission);
      changed = true;
    }
  }

  return { permissions: [...permissions], denied: [...denied], changed };
}

/** Clear a group's extras and revokes back to plain role defaults. */
export function resetGroupPermissions(input: {
  permissions: readonly string[];
  denied: readonly string[];
  groupPermissions: readonly string[];
}): { permissions: string[]; denied: string[]; changed: boolean } {
  const group = new Set(input.groupPermissions);
  const permissions = input.permissions.filter((permission) => !group.has(permission));
  const denied = input.denied.filter((permission) => !group.has(permission));
  return {
    permissions,
    denied,
    changed:
      permissions.length !== input.permissions.length ||
      denied.length !== input.denied.length,
  };
}

/** Count of explicit extras and revokes actually stored for a member. */
export function countPermissionOverrides(
  permissions: readonly string[] | undefined,
  role: string,
  roleDefaults: readonly string[],
): PermissionCounts {
  const inherited = new Set(roleDefaults);
  let explicit = 0;
  let revoked = 0;
  for (const entry of new Set(permissions ?? [])) {
    if (entry.startsWith('!')) {
      if (inherited.has(entry.slice(1))) revoked += 1;
    } else if (!inherited.has(entry)) {
      explicit += 1;
    }
  }
  return { explicit, revoked };
}

/**
 * Compact roster summary: names of explicit extras and revokes. Long lists are
 * capped so a row stays readable; the full list remains in the editor.
 */
export function summarizePermissionOverrides(
  permissions: readonly string[] | undefined,
  roleDefaults: readonly string[],
  limit = 3,
): { text: string; explicit: string[]; revoked: string[]; truncated: boolean } {
  const inherited = new Set(roleDefaults);
  const explicit: string[] = [];
  const revoked: string[] = [];
  for (const entry of [...new Set(permissions ?? [])].sort()) {
    if (entry.startsWith('!')) {
      const key = entry.slice(1);
      if (inherited.has(key)) revoked.push(key);
    } else if (!inherited.has(entry)) {
      explicit.push(entry);
    }
  }

  const parts = [
    ...explicit.map((permission) => `+${permission}`),
    ...revoked.map((permission) => `!${permission}`),
  ];
  const shown = parts.slice(0, limit);
  const truncated = parts.length > limit;
  return {
    text:
      parts.length === 0
        ? 'Role defaults only'
        : `${shown.join(', ')}${truncated ? ` +${parts.length - limit} more` : ''}`,
    explicit,
    revoked,
    truncated,
  };
}
