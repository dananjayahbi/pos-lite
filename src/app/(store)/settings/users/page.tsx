import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import UserPermissionsSettingsClient from '@/components/settings/UserPermissionsSettingsClient';

export const metadata = { title: 'Team & Permissions | VelvetPOS' };

export default async function UsersSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageUsers)) redirect('/dashboard');

  return <UserPermissionsSettingsClient />;
}
