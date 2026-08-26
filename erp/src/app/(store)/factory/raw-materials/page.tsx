import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getEffectivePermissions } from '@/lib/constants/permissions';
import { RawMaterialListClient } from '@/components/raw-materials/RawMaterialListClient';

export const metadata = {
  title: 'Raw Materials | AyurPOS',
};

export default async function RawMaterialsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.viewRawMaterial)) {
    redirect('/dashboard');
  }

  const permissions = getEffectivePermissions(session.user.role, session.user.permissions);

  return <RawMaterialListClient permissions={permissions} />;
}
