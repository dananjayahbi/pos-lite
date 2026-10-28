import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { getEffectivePermissions } from '@/lib/constants/permissions';
import { SettingsHub } from '@/components/settings/SettingsHub';

export const metadata = { title: 'Settings | AyurPOS' };

export default async function SettingsIndexPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const permissions = getEffectivePermissions(session.user.role, session.user.permissions);

  return <SettingsHub permissions={permissions} />;
}
