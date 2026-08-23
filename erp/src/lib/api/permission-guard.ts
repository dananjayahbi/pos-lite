import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/utils/permissions';
import type { PermissionKey } from '@/lib/constants/permissions';

interface GuardUser {
  permissions?: unknown;
}

/**
 * Shared server-side route guard. Returns a 403 JSON response when the caller
 * lacks `permission`, otherwise returns `null`. Callers short-circuit:
 *
 *   const forbidden = requirePermissionResponse(user, PERMISSIONS.X.y);
 *   if (forbidden) return forbidden;
 */
export function requirePermissionResponse(
  user: GuardUser | null | undefined,
  permission: PermissionKey,
): NextResponse | null {
  if (!hasPermission(user, permission)) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403 },
    );
  }
  return null;
}
