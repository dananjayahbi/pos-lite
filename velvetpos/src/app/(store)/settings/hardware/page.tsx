import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import HardwareSettingsForm from '@/components/settings/HardwareSettingsForm';

export const metadata = { title: 'Hardware Settings | VelvetPOS' };

const DENIED_ROLES = new Set(['CASHIER', 'STOCK_CLERK']);

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
  if (!session?.user?.tenantId) redirect('/login');
  if (DENIED_ROLES.has(session.user.role)) redirect('/pos');

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
