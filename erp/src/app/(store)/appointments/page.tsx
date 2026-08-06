import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/feature-guard';
import { AppointmentsPageClient } from './AppointmentsPageClient';

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');

  // Feature guard: check if appointments module is enabled
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!isModuleEnabled((tenant?.settings ?? {}) as Record<string, unknown>, 'appointments')) {
    redirect('/dashboard');
  }

  if (!hasPermission(session.user, PERMISSIONS.APPOINTMENT.viewAppointment)) {
    redirect('/dashboard');
  }

  return <AppointmentsPageClient />;
}
