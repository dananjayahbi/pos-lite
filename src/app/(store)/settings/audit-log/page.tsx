import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AuditLogPageClient from '@/components/audit/AuditLogPageClient';

export const metadata = { title: 'Audit Log | VelvetPOS' };

const DENIED_ROLES = new Set(['CASHIER', 'STOCK_CLERK']);

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');
  if (DENIED_ROLES.has(session.user.role)) redirect('/pos');

  return <AuditLogPageClient />;
}
