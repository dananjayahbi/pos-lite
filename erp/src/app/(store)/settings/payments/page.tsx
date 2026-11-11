import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { readLankaQrSettingsFromTenantSettings } from '@/lib/payments/lanka-qr-config';
import PaymentSettingsForm from '@/components/settings/PaymentSettingsForm';

export const metadata = { title: 'Payment Settings | AyurPOS' };

export default async function PaymentSettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  if (!hasPermission(session.user, PERMISSIONS.SETTINGS.managePayments)) redirect('/dashboard');

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Payment settings</h1>
        <p className="mt-1 text-sm text-sand-ink">
          Configure how the POS accepts LankaQR — the national QR payment standard operated by
          LankaPay. Your bank issues the merchant QR; paste or upload it here so the cashier can
          display it at the counter.
        </p>
      </div>
      <PaymentSettingsForm
        initialValues={readLankaQrSettingsFromTenantSettings(tenant.settings)}
      />
    </div>
  );
}
