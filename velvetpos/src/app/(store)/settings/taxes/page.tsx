import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import TaxSettingsForm from '@/components/settings/TaxSettingsForm';

export const metadata = { title: 'Tax Settings | VelvetPOS' };

export default async function TaxSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.manageTax)) redirect('/dashboard');

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });

  const settings = typeof tenant.settings === 'object' && tenant.settings !== null
    ? (tenant.settings as Record<string, unknown>)
    : {};

  const initialValues = {
    vatRate: typeof settings.vatRate === 'number' ? settings.vatRate : 0,
    ssclRate: typeof settings.ssclRate === 'number' ? settings.ssclRate : 0,
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Tax settings</h1>
        <p className="mt-1 text-sm text-sand">
          Configure the store-wide rates that sales use when products are tagged with VAT or SSCL tax rules.
        </p>
      </div>
      <TaxSettingsForm initialValues={initialValues} />
    </div>
  );
}
