import { getEffectivePermissions, PERMISSIONS } from '@/lib/constants/permissions';
import type { UserRole } from '@/generated/prisma/client';
import {
  resolveShiftAccessScope,
  type ShiftAccessScope,
} from '@/lib/shifts/shift-access-scope';

interface ShiftAccessUser {
  id: string;
  role?: UserRole | undefined;
  permissions?: unknown;
}

/**
 * Server-side adapter for `resolveShiftAccessScope`: resolves the session's
 * shift capabilities and management signals once so every shift route/page
 * applies the same scope.
 */
export function resolveShiftAccessForUser(user: ShiftAccessUser): ShiftAccessScope {
  const permissions = getEffectivePermissions(user.role, user.permissions);
  const has = (permission: string) => permissions.includes(permission);

  return resolveShiftAccessScope({
    canAccessShifts:
      has(PERMISSIONS.STAFF.viewShift) ||
      has(PERMISSIONS.STAFF.openShift) ||
      has(PERMISSIONS.STAFF.closeShift),
    role: user.role,
    canViewSaleHistory: has(PERMISSIONS.SALE.viewSaleHistory),
    userId: user.id,
  });
}
