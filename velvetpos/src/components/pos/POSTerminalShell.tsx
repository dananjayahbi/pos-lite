'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Clock, LogOut, RotateCcw, WifiOff, Loader2 } from 'lucide-react';
import { ShiftCloseModal } from '@/components/pos/ShiftCloseModal';
import { CartPanel } from '@/components/pos/CartPanel';
import { useOfflineSync } from '@/hooks/useOfflineSync';

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
  const [elapsed, setElapsed] = useState('');

  const updateElapsed = useCallback(() => {
    const diff = Date.now() - new Date(shiftOpenedAt).getTime();
    setElapsed(formatElapsed(diff));
  }, [shiftOpenedAt]);

  useEffect(() => {
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [updateElapsed]);

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
  children: React.ReactNode;
}

export function POSTerminalShell({
  shiftId,
  shiftOpenedAt,
  cashierName,
  children,
}: POSTerminalShellProps) {
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const { isOnline, isSyncing } = useOfflineSync();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-espresso h-dvh overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <span className="font-display text-sand text-sm">VelvetPOS</span>

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
          <Link
            href="/pos/returns"
            className="text-terracotta hover:text-pearl transition-colors p-1.5"
            aria-label="Return history"
          >
            <RotateCcw className="h-5 w-5" />
          </Link>
          <Link
            href="/pos/history"
            className="text-terracotta hover:text-pearl transition-colors p-1.5"
            aria-label="Shift history"
          >
            <Clock className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={() => setCloseModalOpen(true)}
            className="text-terracotta hover:text-pearl transition-colors p-1.5"
            aria-label="Close shift"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Left panel */}
        <div className="w-full md:w-[63%] bg-linen overflow-y-auto">
          {children}
        </div>

        {/* Right panel */}
        <div className="w-full md:w-[37%] bg-pearl overflow-hidden">
          <CartPanel shiftId={shiftId} />
        </div>
      </div>

      <ShiftCloseModal
        shiftId={shiftId}
        open={closeModalOpen}
        onOpenChange={setCloseModalOpen}
      />
    </div>
  );
}
