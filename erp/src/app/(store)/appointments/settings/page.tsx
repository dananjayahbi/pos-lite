import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { AppointmentsSettingsPageClient } from './AppointmentsSettingsPageClient';

export default async function AppointmentsSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');
  if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.manageSettings)) redirect('/dashboard');

  return <AppointmentsSettingsPageClient />;
}
