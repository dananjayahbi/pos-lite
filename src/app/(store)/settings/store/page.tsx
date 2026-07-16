import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import StoreProfileSettingsForm from '@/components/settings/StoreProfileSettingsForm';

export const metadata = { title: 'Store Profile | VelvetPOS' };

export default async function StoreProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageStoreProfile)) redirect('/dashboard');

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
    select: {
      name: true,
      logoUrl: true,
      settings: true,
    },
  });

  const settings = typeof tenant.settings === 'object' && tenant.settings !== null
    ? (tenant.settings as Record<string, unknown>)
    : {};

  const initialValues = {
    storeName: tenant.name,
    logoUrl: tenant.logoUrl ?? '',
    address: typeof settings.address === 'string' ? settings.address : '',
    phoneNumber: typeof settings.phoneNumber === 'string' ? settings.phoneNumber : '',
    receiptFooter: typeof settings.receiptFooter === 'string' ? settings.receiptFooter : '',
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Store profile</h1>
        <p className="mt-1 text-sm text-sand">
          Update the public-facing basics your staff and customers see most often.
        </p>
      </div>
      <StoreProfileSettingsForm initialValues={initialValues} />
    </div>
  );
}
