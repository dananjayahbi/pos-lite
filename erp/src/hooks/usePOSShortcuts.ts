'use client';

import { useEffect, useRef } from 'react';
import { matchesShortcut } from '@/lib/pos/keyboard';
import type { POSShortcutSpec } from '@/lib/pos/keyboard';

export interface POSShortcutBinding extends POSShortcutSpec {
  handler: (event: KeyboardEvent) => void;
}

/**
 * Registers POS-wide keyboard shortcuts on `window`.
 *
 * Bindings are matched against `KeyboardEvent` with the rules in
 * `matchesShortcut`, so a shortcut never steals a printable key from a text
 * field unless it explicitly opts in with `allowInEditable`.
 *
 * The latest bindings are read from a ref, so callers can pass inline arrays
 * without re-registering (or leaking) listeners on every render.
 */
export function usePOSShortcuts(bindings: POSShortcutBinding[]) {
  const bindingsRef = useRef(bindings);

  // Keep the latest bindings without re-registering the listener. The update
  // happens after commit, which the compiler rules require.
  useEffect(() => {
    bindingsRef.current = bindings;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindingsRef.current) {
        if (!matchesShortcut(event, binding)) continue;
        event.preventDefault();
        binding.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
