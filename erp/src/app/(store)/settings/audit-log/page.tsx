import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/page-guards';
import { PERMISSIONS } from '@/lib/constants/permissions';
import AuditLogPageClient from '@/components/audit/AuditLogPageClient';

export const metadata = { title: 'Audit Log | AyurPOS' };

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');
  requirePagePermission(session.user, PERMISSIONS.SETTINGS.viewAuditLog);

  return <AuditLogPageClient />;
}
