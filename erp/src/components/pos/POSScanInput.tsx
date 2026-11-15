'use client';

import { useCallback, useEffect, useRef } from 'react';
import { ScanLine, X } from 'lucide-react';
import { POS_BARCODE_INPUT_ID, focusPOSBarcodeInput, isPOSDialogOpen } from '@/lib/pos/keyboard';

const BURST_INTERVAL_MS = 60;
const BURST_IDLE_FLUSH_MS = 120;

interface POSScanInputProps {
  value: string;
  onValueChange: (value: string) => void;
  /**
   * Resolves the code as a barcode/SKU. Resolve `true` when the code was
   * consumed (added to the cart) so the box clears itself and stays ready for
   * the next scan; resolve `false` to leave the text in place as a search.
   */
  onScan: (code: string) => Promise<boolean> | boolean;
  /** Minimum length before a burst is auto-flushed without an Enter key. */
  minScanLength?: number;
}

/**
 * The POS "barcode box": search plus always-ready scan target.
 *
 * - Auto-focuses on mount and reclaims focus whenever nothing else meaningful
 *   holds it, so a hardware scanner can be fired at any time.
 * - Enter resolves the text immediately (barcode/SKU first, search otherwise).
 * - A keyboard-wedge burst is auto-flushed after a short idle, covering
 *   scanners configured without a trailing Enter.
 * - It is the single text field on the screen, so touch search, mouse search,
 *   and keyboard search all share one predictable target.
 */
export function POSScanInput({
  value,
  onValueChange,
  onScan,
  minScanLength = 6,
}: POSScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyAtRef = useRef(0);
  const burstRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const submitValue = useCallback(
    async (rawCode: string) => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = undefined;
      }
      burstRef.current = false;
      const code = rawCode.trim();
      if (!code) return;
      const consumed = await onScan(code);
      if (consumed) onValueChange('');
      focusPOSBarcodeInput();
    },
    [onScan, onValueChange],
  );

  // Keep the scanner ready: focus on mount, when returning to the tab, and
  // whenever a tap lands on a non-interactive part of the screen.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const focusIfIdle = () => {
      if (isPOSDialogOpen()) return;
      const active = document.activeElement;
      if (active === input) return;
      if (active && active !== document.body && active !== document.documentElement) return;
      input.focus({ preventScroll: true });
    };

    const onPointerUp = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [data-pos-no-scan-focus]',
        )
      ) {
        return;
      }
      // A pointerup that focused a card/button leaves activeElement there, so
      // focusIfIdle keeps the cashier's keyboard target intact.
      focusIfIdle();
    };

    const raf = requestAnimationFrame(focusIfIdle);
    // Focus synchronously as well: a scanner fired right after render must not
    // lose its first characters to the gap before the next animation frame.
    focusIfIdle();
    window.addEventListener('focus', focusIfIdle);
    document.addEventListener('visibilitychange', focusIfIdle);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('focus', focusIfIdle);
      document.removeEventListener('visibilitychange', focusIfIdle);
      document.removeEventListener('pointerup', onPointerUp);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  return (
    <div>
      <div className="relative">
        <ScanLine
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-ink"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={POS_BARCODE_INPUT_ID}
          data-pos-barcode-input=""
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          role="searchbox"
          aria-label="Scan barcode or search products"
          aria-keyshortcuts="F2"
          aria-describedby="pos-scan-hint"
          placeholder="Search products, SKU, barcode… or scan"
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            onValueChange(next);

            const now = Date.now();
            if (now - lastKeyAtRef.current <= BURST_INTERVAL_MS) burstRef.current = true;
            lastKeyAtRef.current = now;

            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (burstRef.current && next.trim().length >= minScanLength) {
              idleTimerRef.current = setTimeout(() => {
                void submitValue(next);
              }, BURST_IDLE_FLUSH_MS);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submitValue(event.currentTarget.value);
              return;
            }
            if (event.key === 'Escape') {
              if (event.currentTarget.value) {
                event.preventDefault();
                onValueChange('');
              }
              return;
            }
            const now = Date.now();
            if (now - lastKeyAtRef.current <= BURST_INTERVAL_MS) burstRef.current = true;
            lastKeyAtRef.current = now;
          }}
          className="h-11 w-full rounded-lg border border-mist bg-white py-2 pl-9 pr-11 font-body text-base text-espresso placeholder:text-mist-ink focus:border-sand focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onValueChange('');
              focusPOSBarcodeInput();
            }}
            className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-mist-ink transition-colors hover:text-espresso"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p id="pos-scan-hint" className="mt-1 font-body text-[11px] text-mist-ink">
        Scanner ready — scan any time. <kbd className="font-mono">F2</kbd> refocuses,
        <kbd className="ml-1 font-mono">Enter</kbd> adds, <kbd className="ml-1 font-mono">?</kbd> shows all keys.
      </p>
    </div>
  );
}
