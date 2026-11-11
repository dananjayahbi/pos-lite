import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import PayrollReportsClient from '@/components/payroll/PayrollReportsClient';

export const metadata = { title: 'Payroll Reports & Bank Sheets | AyurPOS' };

export default async function PayrollReportsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  if (!hasPermission(session.user, PERMISSIONS.PAYROLL.viewPayroll)) redirect('/dashboard');

  return <PayrollReportsClient />;
}
