'use client';

import { Keyboard, MousePointer2 } from 'lucide-react';
import { usePOSShortcuts } from '@/hooks/usePOSShortcuts';
import { isPOSDialogOpen } from '@/lib/pos/keyboard';
import {
  POS_INPUT_MODE_OPTIONS,
  type POSInputMode,
} from '@/lib/pos/input-mode';

interface InputModeSelectorProps {
  mode: POSInputMode;
  onChange: (mode: POSInputMode) => void;
}

const MODE_ICONS = {
  'mouse-keyboard': MousePointer2,
  'keyboard-only': Keyboard,
} as const;

/**
 * Header switch between the classic grid layout and the keyboard-only console.
 *
 * Rendered as a segmented control so the current profile is visible at a
 * glance; the choice is persisted by `usePOSInputMode` and survives reloads.
 */
export function InputModeSelector({ mode, onChange }: InputModeSelectorProps) {
  // The selector is the only way back from keyboard-only mode, so it must be
  // reachable without a pointer. Ignored while a dialog owns the screen.
  usePOSShortcuts([
    {
      key: 'M',
      alt: true,
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen()) return;
        onChange(mode === 'keyboard-only' ? 'mouse-keyboard' : 'keyboard-only');
      },
    },
  ]);

  return (
    <div
      role="group"
      aria-label="POS input mode"
      aria-keyshortcuts="Alt+M"
      data-testid="pos-mode-selector"
      className="flex items-center rounded-lg border border-pearl/20 bg-black/20 p-0.5"
    >
      {POS_INPUT_MODE_OPTIONS.map((option) => {
        const Icon = MODE_ICONS[option.value];
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            title={option.description}
            data-pos-mode={option.value}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 py-1 font-body text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pearl/70 ${
              active
                ? 'bg-terracotta text-pearl shadow-sm'
                : 'text-pearl/60 hover:text-pearl hover:bg-pearl/10'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">{option.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
