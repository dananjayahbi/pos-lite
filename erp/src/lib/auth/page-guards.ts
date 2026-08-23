import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/utils/permissions';
import type { PermissionKey } from '@/lib/constants/permissions';

interface PageUser {
  permissions?: unknown;
}

/**
 * Shared server-side page guard. Redirects to `/pos` when the user lacks the
 * given permission, keeping page gating consistent with the API-side
 * `requirePermissionResponse` guard.
 */
export function requirePagePermission(
  user: PageUser | null | undefined,
  permission: PermissionKey,
): void {
  if (!hasPermission(user, permission)) {
    redirect('/pos');
  }
}
