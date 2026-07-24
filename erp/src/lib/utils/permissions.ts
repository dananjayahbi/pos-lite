import type { PermissionKey } from '@/lib/constants/permissions';

interface UserLike {
  permissions?: unknown;
}

function normalizePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions.filter((value): value is string => typeof value === 'string');
}

export function hasPermission(user: UserLike | null | undefined, permission: PermissionKey): boolean {
  if (!user) {
    return false;
  }

  const permissions = normalizePermissions(user.permissions);
  return permissions.includes(permission);
}

export function requirePermission(user: UserLike | null | undefined, permission: PermissionKey): void {
  if (!hasPermission(user, permission)) {
    throw {
      status: 403,
      message: 'Forbidden: insufficient permissions',
    };
  }
}
