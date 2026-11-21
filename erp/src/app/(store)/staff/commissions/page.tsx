import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { canViewCommissionReports } from '@/lib/services/commission-report-access.core';
import CommissionReportsClient from '@/components/commissions/CommissionReportsClient';

export const metadata = { title: 'Commission Reports | AyurPOS' };

/**
 * ARGUS #364: server-side gate matching the commission APIs. Cashiers lack
 * staff:view/manage, so they are redirected before the page renders a
 * zero-value report that would immediately fail its data requests.
 */
export default async function CommissionReportsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  if (!canViewCommissionReports(session.user)) redirect('/dashboard');

  return <CommissionReportsClient />;
}
