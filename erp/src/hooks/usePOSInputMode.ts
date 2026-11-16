'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  getPOSInputModeServerSnapshot,
  getPOSInputModeSnapshot,
  setPOSInputMode,
  subscribePOSInputMode,
  type POSInputMode,
} from '@/lib/pos/input-mode';

/**
 * Reads and updates the cashier's POS input profile.
 *
 * The mode is stored in `localStorage`, so this hook is also how a second tab
 * (or a reload) picks the same layout back up. Components that only render
 * differently by mode can read it without owning the preference.
 */
export function usePOSInputMode() {
  const mode = useSyncExternalStore(
    subscribePOSInputMode,
    getPOSInputModeSnapshot,
    getPOSInputModeServerSnapshot,
  );

  const setMode = useCallback((next: POSInputMode) => {
    setPOSInputMode(next);
  }, []);

  return { mode, setMode };
}
