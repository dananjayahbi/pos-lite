import {
  PERMISSION_DENY_PREFIX,
  ROLE_PERMISSIONS,
  isDeniedPermissionEntry,
  permissionKeyFromEntry,
  type AssignableRole,
  type PermissionKey,
} from '@/lib/constants/permissions';

/**
 * Staff permission-set math (ARGUS #459).
 *
 * `User.permissions` historically stored the whole effective set for some
 * accounts, including permissions inherited from the role. The settings editor
 * shows and saves only the EXPLICIT extras (the role defaults are implicit), so
 * every display/save path must normalize the same way:
 *
 *   extra = stored permissions - role defaults
 *
 * A no-op save (same role, active flag and normalized extras) must not PATCH,
 * because the API bumps `sessionVersion` and writes an audit row for a
 * permission change - logging the user out for nothing.
 */

/** Unique, sorted strings from an untrusted permissions array. */
export function normalizePermissionList(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return [];
  return Array.from(
    new Set(permissions.filter((permission): permission is string => typeof permission === 'string')),
  ).sort();
}

/**
 * Split stored entries into additive grants and explicit denies (ARGUS #464).
 * `!sale:void` in the stored array means the role default `sale:void` is
 * revoked for this user. Deny entries are de-duplicated and sorted.
 */
export function splitPermissionEntries(permissions: unknown): {
  granted: string[];
  denied: string[];
} {
  const normalized = normalizePermissionList(permissions);
  return {
    granted: normalized.filter((entry) => !isDeniedPermissionEntry(entry)),
    denied: normalized
      .filter(isDeniedPermissionEntry)
      .map((entry) => permissionKeyFromEntry(entry)),
  };
}

/** Role defaults for an assignable role; unknown roles inherit nothing. */
export function roleDefaultPermissions(role: string | undefined): string[] {
  if (!role) return [];
  const defaults = ROLE_PERMISSIONS[role as AssignableRole];
  return Array.isArray(defaults) ? [...defaults] : [];
}

/**
 * Explicit extras only: stored additive permissions minus role-inherited
 * defaults. Deny entries (`!key`) are not extras and never appear here.
 */
export function extraPermissions(
  permissions: unknown,
  role: string | undefined,
): string[] {
  const inherited = new Set(roleDefaultPermissions(role));
  return splitPermissionEntries(permissions).granted.filter(
    (permission) => !inherited.has(permission),
  );
}

/** Explicit revokes: role defaults the user is denied (ARGUS #464). */
export function deniedPermissions(permissions: unknown, role: string | undefined): string[] {
  const inherited = new Set(roleDefaultPermissions(role));
  return splitPermissionEntries(permissions).denied.filter((permission) =>
    inherited.has(permission),
  );
}

/** Role defaults plus explicit extras, minus explicit denies. */
export function effectivePermissions(
  role: string | undefined,
  explicitPermissions: unknown,
  denied: readonly string[] = [],
): string[] {
  const deniedSet = new Set(denied);
  const { denied: storedDenies } = splitPermissionEntries(explicitPermissions);
  for (const entry of storedDenies) deniedSet.add(entry);

  return Array.from(
    new Set([
      ...roleDefaultPermissions(role),
      ...splitPermissionEntries(explicitPermissions).granted,
    ]),
  )
    .filter((permission) => !deniedSet.has(permission))
    .sort();
}

/** Compare two permission lists as sets (order/duplicates ignored). */
export function samePermissionSet(left: unknown, right: unknown): boolean {
  const a = normalizePermissionList(left);
  const b = normalizePermissionList(right);
  if (a.length !== b.length) return false;
  return a.every((permission, index) => permission === b[index]);
}

export interface StaffPermissionDraft {
  role: string;
  isActive: boolean;
  permissions: unknown;
}

export interface StaffPermissionSnapshot {
  role: string;
  isActive: boolean;
  permissions: unknown;
}

/**
 * True when saving the draft would not change anything the API cares about:
 * same role, same active flag, and the same normalized explicit extras.
 */
export function isStaffPermissionDraftUnchanged(
  existing: StaffPermissionSnapshot,
  draft: StaffPermissionDraft,
): boolean {
  if (existing.role !== draft.role) return false;
  if (existing.isActive !== draft.isActive) return false;
  if (
    !samePermissionSet(
      deniedPermissions(existing.permissions, existing.role),
      deniedPermissions(draft.permissions, draft.role),
    )
  ) {
    return false;
  }
  return samePermissionSet(
    extraPermissions(existing.permissions, existing.role),
    extraPermissions(draft.permissions, draft.role),
  );
}

/**
 * Permission keys to store: the draft extras relative to the DRAFT role.
 * Inherited defaults are stripped so a role change cannot persist stale
 * defaults as explicit overrides.
 */
export function permissionsToSave(
  draftPermissions: unknown,
  draftRole: string,
): PermissionKey[] {
  return extraPermissions(draftPermissions, draftRole) as PermissionKey[];
}

/**
 * Full stored payload for a save: explicit extras plus `!`-prefixed revokes
 * (ARGUS #464). Revokes keep only keys the selected role would otherwise
 * inherit, so a role change cannot leave a stale deny behind.
 */
export function permissionPayloadToSave(
  draftPermissions: unknown,
  draftRole: string,
  denied: readonly string[] = [],
): string[] {
  const extras = extraPermissions(draftPermissions, draftRole);
  const inherited = new Set(roleDefaultPermissions(draftRole));
  const denies = Array.from(new Set(denied))
    .filter((permission) => inherited.has(permission))
    .sort()
    .map((permission) => `${PERMISSION_DENY_PREFIX}${permission}`);
  return [...extras, ...denies];
}
