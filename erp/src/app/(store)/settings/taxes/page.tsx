import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import TaxSettingsForm from '@/components/settings/TaxSettingsForm';
import { Card, CardContent } from '@/components/ui/card';
import { canManageTaxSettings } from '@/lib/settings/settingsAudit.core';

export const metadata = { title: 'Tax Settings | AyurPOS' };

export default async function TaxSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  // ARGUS #468 — VAT/SSCL are owner-only. Managers (and anyone with a stale
  // per-user override) get an explicit message instead of an editable form.
  if (!canManageTaxSettings(session.user.role)) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Tax settings</h1>
        </div>
        <Card className="border-mist">
          <CardContent className="py-10 text-center text-sm text-sand-ink">
            Tax rates are owner-only. Ask the store owner to change VAT or SSCL.
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <p className="mt-1 text-sm text-sand-ink">
          Configure the store-wide rates that sales use when products are tagged with VAT or SSCL tax rules.
          Only the store owner can change these rates.
        </p>
      </div>
      <TaxSettingsForm initialValues={initialValues} />
    </div>
  );
}
