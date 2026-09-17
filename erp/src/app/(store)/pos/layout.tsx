import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCurrentShift } from '@/lib/services/shift.service';
import { ShiftGate } from '@/components/pos/ShiftGate';
import { getTenantBranding } from '@/lib/tenant-branding';

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect('/login');

  if (!hasPermission(session.user, PERMISSIONS.SALE.createSale)) {
    redirect('/dashboard');
  }

  const shift = await getCurrentShift(tenantId, session.user.id);
  // xc-03-waiver: presentational shortcut only — this decides whether to render
  // a convenience link to the owner dashboard. It authorizes nothing: the
  // dashboard itself is permission-gated by the shared page guard.
  const showOwnerDashboardShortcut = session.user.role === 'OWNER'; // xc-03-waiver: presentational shortcut only — authorizes nothing (the dashboard is separately gated)
  const branding = await getTenantBranding(tenantId);

  // M18-01 (BUG-52): the open-shift gate moved into the client `ShiftGate` so
  // that `/pos/shift-report` can render the report page's own empty/error
  // states when no shift is open. Previously this layout early-returned
  // <ShiftOpenModal/> and never rendered children, so an invalid/missing
  // ?shiftId surfaced the "Open Your Shift" screen instead of the documented
  // "No shift ID provided." / fetch-failure UI. Behavior for every other POS
  // route (and for the shell when a shift IS open) is unchanged.
  return (
    <ShiftGate
      hasOpenShift={Boolean(shift)}
      shiftId={shift?.id}
      shiftOpenedAt={shift?.openedAt.toISOString()}
      cashierName={session.user.name ?? 'Cashier'}
      showOwnerDashboardShortcut={showOwnerDashboardShortcut}
      businessName={branding.name}
      businessLogoUrl={branding.logoUrl}
    >
      {children}
    </ShiftGate>
  );
}
