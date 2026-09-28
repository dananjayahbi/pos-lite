'use client';

import { usePathname } from 'next/navigation';
import { ShiftOpenModal } from '@/components/pos/ShiftOpenModal';
import { POSTerminalShell } from '@/components/pos/POSTerminalShell';

interface ShiftGateProps {
  /** Whether the signed-in cashier currently has an OPEN shift. */
  hasOpenShift: boolean;
  /** The open shift's id — required when `hasOpenShift` is true. */
  shiftId?: string | undefined;
  /** ISO timestamp of the open shift — required when `hasOpenShift` is true. */
  shiftOpenedAt?: string | undefined;
  cashierName: string;
  showOwnerDashboardShortcut?: boolean | undefined;
  businessName: string;
  businessLogoUrl: string | null;
  children: React.ReactNode;
}

/**
 * M18-01 (BUG-52): client-side replacement for the POS layout's early
 * `return <ShiftOpenModal/>`. The layout used to short-circuit children
 * entirely when the cashier had no open shift, which made the shift-report
 * page's own empty/error states unreachable — `/pos/shift-report?shiftId=…`
 * rendered the "Open Your Shift" screen instead of the report (or its
 * "No shift ID provided." / fetch-failure states).
 *
 * The gate keeps the same rule for every POS surface EXCEPT `/pos/shift-report`
 * (URL frozen by the QA contract): with no open shift it still renders the
 * ShiftOpenModal, but on the shift-report path it renders the children so the
 * report page can show its own documented empty/error UI. With an open shift
 * nothing changes — children render inside POSTerminalShell exactly as before.
 */
export function ShiftGate({
  hasOpenShift,
  shiftId,
  shiftOpenedAt,
  cashierName,
  showOwnerDashboardShortcut = false,
  businessName,
  businessLogoUrl,
  children,
}: ShiftGateProps) {
  const pathname = usePathname();
  const isShiftReport = pathname.startsWith('/pos/shift-report');

  if (!hasOpenShift) {
    if (isShiftReport) {
      // The report page reads ?shiftId itself and renders its own
      // empty/error state; do not bounce the cashier to ShiftOpenModal.
      return <>{children}</>;
    }
    return (
      <ShiftOpenModal
        cashierName={cashierName}
        showOwnerDashboardShortcut={showOwnerDashboardShortcut}
        businessName={businessName}
        businessLogoUrl={businessLogoUrl}
      />
    );
  }

  return (
    <POSTerminalShell
      shiftId={shiftId ?? ''}
      shiftOpenedAt={shiftOpenedAt ?? ''}
      cashierName={cashierName}
      showOwnerDashboardShortcut={showOwnerDashboardShortcut}
      businessName={businessName}
      businessLogoUrl={businessLogoUrl}
    >
      {children}
    </POSTerminalShell>
  );
}
