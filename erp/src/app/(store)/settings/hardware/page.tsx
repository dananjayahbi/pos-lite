import { auth } from '@/lib/auth';
import { denialRouteFor, requirePagePermission } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PERMISSIONS } from '@/lib/constants/permissions';
import HardwareSettingsForm from '@/components/settings/HardwareSettingsForm';

export const metadata = { title: 'Hardware Settings | AyurPOS' };

type HardwareSettings = {
  printerType: 'NETWORK' | 'USB';
  host: string;
  port: number;
  cashDrawerEnabled: boolean;
  cfdEnabled: boolean;
};

function parseHardwareSettings(settings: unknown): HardwareSettings {
  const raw = (settings as Record<string, unknown> | null)?.hardware as
    | Record<string, unknown>
    | undefined;

  return {
    printerType:
      raw?.printer &&
      typeof raw.printer === 'object' &&
      (raw.printer as Record<string, unknown>).type === 'USB'
        ? 'USB'
        : 'NETWORK',
    host: String(
      (raw?.printer &&
        typeof raw.printer === 'object' &&
        (raw.printer as Record<string, unknown>).host) ||
        '',
    ),
    port: Number(
      (raw?.printer &&
        typeof raw.printer === 'object' &&
        (raw.printer as Record<string, unknown>).port) || 9100,
    ),
    cashDrawerEnabled: Boolean(raw?.cashDrawerEnabled),
    cfdEnabled: Boolean(raw?.cfdEnabled),
  };
}

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

  const initialValues = parseHardwareSettings(tenant.settings);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <h1 className="font-display text-2xl font-bold text-espresso">
        Hardware &amp; Peripherals
      </h1>
      <HardwareSettingsForm initialValues={initialValues} />
    </div>
  );
}
