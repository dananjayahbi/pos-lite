import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { AppointmentsServicesPageClient } from './AppointmentsServicesPageClient';

export default async function AppointmentsServicesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');
  if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.viewAppointment)) redirect('/dashboard');

  return <AppointmentsServicesPageClient />;
}
