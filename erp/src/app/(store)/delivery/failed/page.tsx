import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { isModuleEnabled } from '@/lib/feature-guard';
import { prisma } from '@/lib/prisma';
import { PageContainer } from '@/components/shared/PageContainer';
import { FailedDeliveriesClient } from '@/components/delivery/FailedDeliveriesClient';

export const metadata = {
  title: 'Failed Deliveries & Recovery | AyurPOS',
};

export default async function FailedDeliveriesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const tenantId = session.user.tenantId;
  if (!tenantId) redirect(denialRouteFor(session.user));

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!isModuleEnabled((tenant?.settings ?? {}) as Record<string, unknown>, 'delivery')) {
    redirect('/dashboard');
  }
  if (!hasPermission(session.user, PERMISSIONS.REPORT.viewRecoveryReport)) {
    redirect('/dashboard');
  }

  return (
    <PageContainer>
      <FailedDeliveriesClient />
    </PageContainer>
  );
}
