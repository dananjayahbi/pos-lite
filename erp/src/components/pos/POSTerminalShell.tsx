'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, LayoutDashboard, LogOut, RotateCcw, WifiOff, Loader2 } from 'lucide-react';
import { ShiftCloseModal } from '@/components/pos/ShiftCloseModal';
import { CartPanel } from '@/components/pos/CartPanel';
import { POSShortcutHelp } from '@/components/pos/POSShortcutHelp';
import { FullscreenToggle } from '@/components/pos/FullscreenToggle';
import { InputModeSelector } from '@/components/pos/InputModeSelector';
import { KeyboardPOSWorkspace } from '@/components/pos/KeyboardPOSWorkspace';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePOSInputMode } from '@/hooks/usePOSInputMode';
import type { LankaQrSettings } from '@/lib/payments/lanka-qr-config';

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function ShiftIndicator({
  cashierName,
  shiftOpenedAt,
}: {
  cashierName: string;
  shiftOpenedAt: string;
}) {
  const [elapsed, setElapsed] = useState(() =>
    formatElapsed(Date.now() - new Date(shiftOpenedAt).getTime()),
  );

  useEffect(() => {
    const tick = () =>
      setElapsed(formatElapsed(Date.now() - new Date(shiftOpenedAt).getTime()));
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [shiftOpenedAt]);

  return (
    <span className="font-body text-sm text-pearl/80">
      {cashierName} • {elapsed}
    </span>
  );
}

interface POSTerminalShellProps {
  shiftId: string;
  shiftOpenedAt: string;
  cashierName: string;
  showOwnerDashboardShortcut?: boolean;
  businessName: string;
  businessLogoUrl: string | null;
  /** Tenant LankaQR configuration (server-resolved). */
  lankaQr?: LankaQrSettings | undefined;
  /**
   * History surfaces (Sale History, Return History) are read-only reviews of
   * past sales — they have nothing to sell, so the cart column and its
   * customer-linking section are hidden and the content takes the full width.
   */
  showCart?: boolean;
  children: React.ReactNode;
}

export function POSTerminalShell({
  shiftId,
  shiftOpenedAt,
  cashierName,
  showOwnerDashboardShortcut = false,
  businessName,
  businessLogoUrl,
  lankaQr,
  showCart = true,
  children,
}: POSTerminalShellProps) {
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const { isOnline, isSyncing } = useOfflineSync();
  const { mode, setMode } = usePOSInputMode();
  // History surfaces have no ticket, so the profile selector is pointless there.
  const keyboardOnly = showCart && mode === 'keyboard-only';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-espresso h-dvh overflow-hidden">
      {/* Top bar */}
      <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1 sm:px-4">
        <div className="flex items-center gap-2">
          {businessLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={businessLogoUrl} alt="" className="h-5 w-5 rounded object-contain" />
          ) : null}
          <span className="font-display text-sand-ink text-sm">{businessName}</span>
        </div>

        <ShiftIndicator
          cashierName={cashierName}
          shiftOpenedAt={shiftOpenedAt}
        />

        <div className="flex items-center gap-3">
          {/* Offline / Syncing badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body font-medium transition-opacity duration-300 ${
              !isOnline
                ? 'bg-yellow-500 text-white opacity-100'
                : isSyncing
                  ? 'bg-blue-500 text-white opacity-100'
                  : 'opacity-0 pointer-events-none'
            }`}
            aria-live="polite"
          >
            {!isOnline && (
              <>
                <WifiOff className="h-3 w-3" />
                Offline
              </>
            )}
            {isOnline && isSyncing && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing…
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showCart && <InputModeSelector mode={mode} onChange={setMode} />}
          {showOwnerDashboardShortcut && (
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-terracotta/40 px-2 py-1 text-xs font-medium text-terracotta transition-colors hover:border-pearl hover:text-pearl"
              aria-label="Owner dashboard"
              title="Owner dashboard"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          )}

          <Link
            href="/pos/returns"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-terracotta transition-colors hover:text-pearl focus:outline-none focus-visible:ring-2 focus-visible:ring-pearl/60"
            aria-label="Return history"
            title="Return history"
          >
            <RotateCcw className="h-5 w-5" />
          </Link>
          <Link
            href="/pos/history"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-terracotta transition-colors hover:text-pearl focus:outline-none focus-visible:ring-2 focus-visible:ring-pearl/60"
            aria-label="Shift history"
            title="Shift history"
          >
            <Clock className="h-5 w-5" />
          </Link>
          <POSShortcutHelp />
          <FullscreenToggle />
          <button
            type="button"
            onClick={() => setCloseModalOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-terracotta transition-colors hover:text-pearl focus:outline-none focus-visible:ring-2 focus-visible:ring-pearl/60"
            aria-label="Close shift"
            title="Close shift"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {keyboardOnly ? (
          <KeyboardPOSWorkspace shiftId={shiftId} lankaQr={lankaQr} />
        ) : (
          <>
            {/* Left panel */}
            <div className={`w-full bg-linen overflow-y-auto ${showCart ? 'md:w-[63%]' : 'md:w-full'}`}>
              {children}
            </div>

            {/* Right panel */}
            {showCart && (
              <div className="w-full md:w-[37%] bg-pearl overflow-hidden">
                <ErrorBoundary>
                  <CartPanel shiftId={shiftId} lankaQr={lankaQr} />
                </ErrorBoundary>
              </div>
            )}
          </>
        )}
      </div>

      <ShiftCloseModal
        shiftId={shiftId}
        open={closeModalOpen}
        onOpenChange={setCloseModalOpen}
      />
    </div>
  );
}
