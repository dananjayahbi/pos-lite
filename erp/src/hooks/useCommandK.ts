'use client';

import { useEffect } from 'react';

/**
 * Adds a global Ctrl+K / Cmd+K keyboard handler that toggles the
 * navigation search modal. The callback is called when the shortcut is
 * pressed while the modal is closed.
 */
export function useCommandK(onOpen: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}
