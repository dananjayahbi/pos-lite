import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getEffectivePermissions } from '@/lib/constants/permissions';
import { BomListClient } from '@/components/bom/BomListClient';

export const metadata = {
  title: 'Bill of Materials | AyurPOS',
};

export default async function BomPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  if (!hasPermission(session.user, PERMISSIONS.BOM.viewBom)) {
    redirect('/dashboard');
  }

  const permissions = getEffectivePermissions(session.user.role, session.user.permissions);

  return <BomListClient permissions={permissions} />;
}
