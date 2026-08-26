import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { isModuleEnabled } from '@/lib/feature-guard';
import { prisma } from '@/lib/prisma';
import { PageContainer } from '@/components/shared/PageContainer';
import { ReconciliationClient } from './ReconciliationClient';

export default async function ReconciliationPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!isModuleEnabled((tenant?.settings ?? {}) as Record<string, unknown>, 'delivery')) {
    redirect('/dashboard');
  }
  if (!hasPermission(session.user, PERMISSIONS.DELIVERY.viewReconciliation)) {
    redirect('/dashboard');
  }

  return (
    <PageContainer>
      <ReconciliationClient />
    </PageContainer>
  );
}
