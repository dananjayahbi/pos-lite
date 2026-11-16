'use client';

import { useMemo, useRef } from 'react';
import { Banknote, CreditCard, Layers, QrCode } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type PaymentMethodMode = 'cash' | 'card' | 'lankaqr' | 'split';

interface PaymentMethodOption {
  mode: PaymentMethodMode;
  label: string;
  icon: typeof Banknote;
}

interface PaymentMethodModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: PaymentMethodMode) => void;
  /** LankaQR is only offered when the tenant enabled it. */
  allowLankaQr: boolean;
  /** Formatted amount due, shown above the method list. */
  totalLabel: string;
}

const NUMERIC_SHORTCUTS: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3 };

/**
 * Payment-method chooser as a real modal.
 *
 * The tender list used to be a popover attached to Charge / Pay, which kept
 * focus management tied to a trigger button and made the keyboard flow awkward.
 * A dialog traps focus cleanly, so `F4` → arrows → `Enter` (or `1`–`4`) works
 * without leaving the keyboard, and `Esc` always returns to the barcode box.
 */
export function PaymentMethodModal({
  open,
  onClose,
  onSelect,
  allowLankaQr,
  totalLabel,
}: PaymentMethodModalProps) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const options = useMemo<PaymentMethodOption[]>(() => {
    const list: PaymentMethodOption[] = [
      { mode: 'cash', label: 'Cash', icon: Banknote },
      { mode: 'card', label: 'Card', icon: CreditCard },
    ];
    if (allowLankaQr) {
      list.push({ mode: 'lankaqr', label: 'LankaQR', icon: QrCode });
    }
    list.push({ mode: 'split', label: 'Split', icon: Layers });
    return list;
  }, [allowLankaQr]);

  const focusAt = (index: number) => {
    const count = options.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    buttonsRef.current[next]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = options
      .map((_, index) => buttonsRef.current[index])
      .filter((button): button is HTMLButtonElement => button != null);
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(current + 1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(current <= 0 ? buttons.length - 1 : current - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusAt(buttons.length - 1);
      return;
    }
    const numericIndex = NUMERIC_SHORTCUTS[event.key];
    if (numericIndex !== undefined && numericIndex < options.length) {
      event.preventDefault();
      onSelect(options[numericIndex]!.mode);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          buttonsRef.current[0]?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Charge / Pay</DialogTitle>
          <DialogDescription className="font-body text-sm text-mist-ink">
            Choose a payment method. Use <kbd className="font-mono">↑</kbd>/
            <kbd className="font-mono">↓</kbd> then <kbd className="font-mono">Enter</kbd>, or
            press <kbd className="font-mono">1</kbd>–<kbd className="font-mono">4</kbd>.
          </DialogDescription>
        </DialogHeader>

        <p className="font-body text-sm text-espresso">
          Total due{' '}
          <span className="font-mono text-lg font-bold text-terracotta">{totalLabel}</span>
        </p>

        <div
          role="group"
          aria-label="Payment methods"
          onKeyDown={handleKeyDown}
          className="space-y-1.5"
        >
          {options.map((option, index) => {
            const Icon = option.icon;
            return (
              <button
                key={option.mode}
                ref={(element) => {
                  buttonsRef.current[index] = element;
                }}
                type="button"
                data-payment-method={option.mode}
                aria-label={option.label}
                onClick={() => onSelect(option.mode)}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-mist/50 bg-pearl px-3 py-2 text-left font-body text-sm text-espresso transition-colors hover:border-terracotta hover:bg-linen focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
                <span className="flex-1">{option.label}</span>
                <kbd className="rounded border border-mist bg-linen px-1.5 py-0.5 font-mono text-[11px] text-mist-ink">
                  {index + 1}
                </kbd>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
