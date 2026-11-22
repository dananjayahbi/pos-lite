'use client';

import { usePathname } from 'next/navigation';
import { ShiftOpenModal } from '@/components/pos/ShiftOpenModal';
import { POSTerminalShell } from '@/components/pos/POSTerminalShell';
import type { LankaQrSettings } from '@/lib/payments/lanka-qr-config';

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
  /** Tenant LankaQR configuration, resolved server-side. */
  lankaQr?: LankaQrSettings | undefined;
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
 * ARGUS #113: `/pos/shift-report` (URL frozen by the QA contract) is a
 * standalone report surface. It renders its children directly with no
 * POSTerminalShell and no ShiftOpenModal, so the report is not squeezed into
 * the cart column and prints as a clean document. Every other POS surface keeps
 * the original rule: ShiftOpenModal without an open shift, POSTerminalShell with
 * one.
 */
export function ShiftGate({
  hasOpenShift,
  shiftId,
  shiftOpenedAt,
  cashierName,
  showOwnerDashboardShortcut = false,
  businessName,
  businessLogoUrl,
  lankaQr,
  children,
}: ShiftGateProps) {
  const pathname = usePathname();
  const isShiftReport = pathname.startsWith('/pos/shift-report');
  // Read-only history surfaces show past sales/returns — a live cart (and its
  // customer-linking section) is meaningless there, so it is hidden entirely.
  const isHistorySurface =
    pathname.startsWith('/pos/history') || pathname.startsWith('/pos/returns');

  if (isShiftReport) {
    // Standalone report surface: no terminal shell, no cart rail, no POS
    // chrome — the page reads ?shiftId itself and owns its print layout.
    return <>{children}</>;
  }

  if (!hasOpenShift) {
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
      lankaQr={lankaQr}
      showCart={!isHistorySurface}
    >
      {children}
    </POSTerminalShell>
  );
}
