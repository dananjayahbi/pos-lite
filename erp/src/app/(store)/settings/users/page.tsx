import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { getEffectivePermissions } from '@/lib/constants/permissions';
import { resolveTeamPermissionsAccess } from '@/lib/services/teamPermissionsAccess.core';
import UserPermissionsSettingsClient from '@/components/settings/UserPermissionsSettingsClient';

export const metadata = { title: 'Team & Permissions | AyurPOS' };

/**
 * ARGUS #460 — page, roster read and save now share one model:
 *  - viewing needs `staff:view` (the list route's key);
 *  - Save needs `staff:manage` + `staff:permissions:assign` (the PATCH keys).
 * The old `settings:users` page gate disagreed with both, so a manager either
 * could not reach a roster they may edit or saw an editable grid that 403'd.
 */
export default async function UsersSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const access = resolveTeamPermissionsAccess(
    getEffectivePermissions(session.user.role, session.user.permissions),
  );
  if (!access.canViewRoster) redirect('/dashboard');

  return (
    <UserPermissionsSettingsClient
      canManage={access.canManage}
      canAssignPermissions={access.canAssignPermissions}
      canSave={access.canSave}
      actorRole={session.user.role}
    />
  );
}
