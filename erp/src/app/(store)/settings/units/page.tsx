import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { PERMISSIONS, getEffectivePermissions } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';
import { UnitsPageClient } from '@/components/units/UnitsPageClient';

export const metadata = {
  title: 'Units | AyurPOS',
};

export default async function UnitsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.viewRawMaterial)) {
    redirect('/dashboard');
  }

  const permissions = getEffectivePermissions(session.user.role, session.user.permissions);

  return (
    <UnitsPageClient
      canCreate={permissions.includes(PERMISSIONS.RAW_MATERIAL.createRawMaterial)}
      canEdit={permissions.includes(PERMISSIONS.RAW_MATERIAL.editRawMaterial)}
      canDelete={permissions.includes(PERMISSIONS.RAW_MATERIAL.deleteRawMaterial)}
    />
  );
}
