import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCurrentShift } from '@/lib/services/shift.service';
import { ShiftOpenModal } from '@/components/pos/ShiftOpenModal';
import { POSTerminalShell } from '@/components/pos/POSTerminalShell';

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');

  if (!hasPermission(session.user, PERMISSIONS.SALE.createSale)) {
    redirect('/dashboard');
  }

  const shift = await getCurrentShift(tenantId, session.user.id);
  const showOwnerDashboardShortcut = session.user.role === 'OWNER';

  if (!shift) {
    return (
      <ShiftOpenModal
        cashierName={session.user.name ?? 'Cashier'}
        showOwnerDashboardShortcut={showOwnerDashboardShortcut}
      />
    );
  }

  return (
    <POSTerminalShell
      shiftId={shift.id}
      shiftOpenedAt={shift.openedAt.toISOString()}
      cashierName={session.user.name ?? 'Cashier'}
      showOwnerDashboardShortcut={showOwnerDashboardShortcut}
    >
      {children}
    </POSTerminalShell>
  );
}
