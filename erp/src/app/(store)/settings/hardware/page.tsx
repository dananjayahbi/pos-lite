import { auth } from '@/lib/auth';
import { denialRouteFor, requirePagePermission } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PERMISSIONS } from '@/lib/constants/permissions';
import HardwareSettingsForm from '@/components/settings/HardwareSettingsForm';
import { readHardwareSettings } from '@/lib/settings/hardwareSettings.core';

export const metadata = { title: 'Hardware Settings | AyurPOS' };

export default async function HardwareSettingsPage() {
  const session = await auth();
  // Tenant check first (M03-07): a tenantless SUPER_ADMIN is funnelled away
  // before the permission guard, which would otherwise pass them (ALL_PERMISSIONS).
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));
  // M07-01 (BUG-80): permission gate replaces the role denylist; denied roles
  // redirect to /pos, matching the destination QA pins (tests/07 S3).
  requirePagePermission(session.user, PERMISSIONS.SETTINGS.manageHardware);

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });

  const initialValues = readHardwareSettings(tenant.settings);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <h1 className="font-display text-2xl font-bold text-espresso">
        Hardware &amp; Peripherals
      </h1>
      <HardwareSettingsForm initialValues={initialValues} />
    </div>
  );
}
