import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import UserPermissionsSettingsClient from '@/components/settings/UserPermissionsSettingsClient';

export const metadata = { title: 'Team & Permissions | AyurPOS' };

export default async function UsersSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageUsers)) redirect('/dashboard');

  return <UserPermissionsSettingsClient />;
}
