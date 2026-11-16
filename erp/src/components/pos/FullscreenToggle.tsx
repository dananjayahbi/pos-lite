'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePOSShortcuts } from '@/hooks/usePOSShortcuts';
import { isPOSDialogOpen } from '@/lib/pos/keyboard';

function subscribeFullscreen(listener: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('fullscreenchange', listener);
  return () => document.removeEventListener('fullscreenchange', listener);
}

function getFullscreenSnapshot(): boolean {
  return typeof document !== 'undefined' && document.fullscreenElement != null;
}

function getFullscreenServerSnapshot(): boolean {
  return false;
}

/**
 * POS fullscreen toggle.
 *
 * The terminal often runs windowed inside a browser on a shop PC; a one-click
 * fullscreen action (also `Alt+Enter`) removes the browser chrome so the
 * product grid / keyboard console gets the whole display. The label and icon
 * follow `fullscreenchange`, so Esc/F11 leaving fullscreen stays in sync.
 */
export function FullscreenToggle() {
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    getFullscreenSnapshot,
    getFullscreenServerSnapshot,
  );

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      toast.error('Fullscreen is not available in this browser.');
    }
  }, []);

  usePOSShortcuts([
    {
      key: 'Enter',
      alt: true,
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen()) return;
        void toggleFullscreen();
      },
    },
  ]);

  return (
    <button
      type="button"
      onClick={() => void toggleFullscreen()}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      aria-pressed={isFullscreen}
      aria-keyshortcuts="Alt+Enter"
      title={`${isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} (Alt+Enter)`}
      data-testid="pos-fullscreen-toggle"
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-terracotta transition-colors hover:text-pearl focus:outline-none focus-visible:ring-2 focus-visible:ring-pearl/60"
    >
      {isFullscreen ? (
        <Minimize2 className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
