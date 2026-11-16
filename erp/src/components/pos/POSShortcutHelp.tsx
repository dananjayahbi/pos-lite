'use client';

import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { POS_SHORTCUT_HELP, isPOSDialogOpen } from '@/lib/pos/keyboard';
import { usePOSShortcuts } from '@/hooks/usePOSShortcuts';

/**
 * In-app shortcut guide. POS terminals are often handed over mid-shift, so the
 * keyboard map has to be discoverable without documentation — press `?` or tap
 * the keyboard button.
 */
export function POSShortcutHelp() {
  const [open, setOpen] = useState(false);

  usePOSShortcuts([
    {
      key: '?',
      shift: true,
      handler: () => {
        if (isPOSDialogOpen()) return;
        setOpen(true);
      },
    },
    {
      key: 'F1',
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen()) return;
        setOpen(true);
      },
    },
  ]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-terracotta transition-colors hover:text-pearl focus:outline-none focus-visible:ring-2 focus-visible:ring-pearl/60"
        aria-label="Keyboard shortcuts"
        aria-keyshortcuts="?"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">POS keyboard shortcuts</DialogTitle>
            <DialogDescription className="font-body text-mist-ink">
              Every POS action can be driven from the keyboard. The barcode box keeps
              focus, so a scan works at any point.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 py-1">
            {POS_SHORTCUT_HELP.map((entry) => (
              <li
                key={entry.label}
                className="flex items-center justify-between gap-4 border-b border-mist/30 pb-2 last:border-b-0 last:pb-0"
              >
                <span className="font-body text-sm text-espresso">{entry.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {entry.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded border border-mist bg-linen px-1.5 py-0.5 font-mono text-[11px] text-espresso"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
