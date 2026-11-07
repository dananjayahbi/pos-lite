import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import PayrollClient from '@/components/payroll/PayrollClient';

export const metadata = { title: 'Run Payroll | AyurPOS' };

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  if (!hasPermission(session.user, PERMISSIONS.PAYROLL.viewPayroll)) redirect('/dashboard');

  const params = await searchParams;
  return <PayrollClient initialMonth={params.month} />;
}
