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

/**
 * M03-07 (BUG-9) — tenant-session guard for store pages.
 *
 * The old `if (!session?.user?.tenantId) redirect('/login')` pattern assumed
 * tenant == authenticated and STRANDED a validly-signed-in SUPER_ADMIN (whose
 * tenantId is legitimately null) on the login form. This helper encodes the
 * correct decision once:
 *   - SUPER_ADMIN              → /superadmin/dashboard (agrees with the
 *                                proxy funnel — defense-in-depth, not a
 *                                contradiction of it)
 *   - everything else (no or
 *     tenantless session)      → /login
 *
 * Usage preserves TypeScript narrowing of the tenantId chain:
 *   if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
 */
export function denialRouteFor(user: { role?: string } | null | undefined): string {
  if (user?.role === 'SUPER_ADMIN') {
    return '/superadmin/dashboard';
  }
  return '/login';
}
