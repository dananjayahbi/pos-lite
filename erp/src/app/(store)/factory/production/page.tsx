import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ProductionHistoryClient } from '@/components/bom/ProductionHistoryClient';

export const metadata = {
  title: 'Production History | AyurPOS',
};

/**
 * ARGUS #259 - full production log. The dashboard's compact six-row panel is a
 * summary; this page is the complete, paginated history with run detail.
 */
export default async function FactoryProductionPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  if (!hasPermission(session.user, PERMISSIONS.BOM.viewProductionLog)) {
    redirect('/dashboard');
  }

  return <ProductionHistoryClient />;
}
