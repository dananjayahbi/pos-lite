import {
  getEffectivePermissions,
  type PermissionKey,
} from '@/lib/constants/permissions';
import type { UserRole } from '@/generated/prisma/client';

interface UserLike {
  role?: UserRole;
  permissions?: unknown;
}

/**
 * Check a permission against the user's effective set (role defaults plus any
 * explicit overrides). Sessions cache the effective set at login; evaluating
 * the role here keeps newly added permissions working without forcing every
 * signed-in user to log out and back in.
 */
export function hasPermission(user: UserLike | null | undefined, permission: PermissionKey): boolean {
  if (!user) {
    return false;
  }

  return getEffectivePermissions(user.role, user.permissions).includes(permission);
}

export function requirePermission(user: UserLike | null | undefined, permission: PermissionKey): void {
  if (!hasPermission(user, permission)) {
    throw {
      status: 403,
      message: 'Forbidden: insufficient permissions',
    };
  }
}
