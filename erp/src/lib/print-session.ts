'use client';

/**
 * Tracks when the global print overlay closes.
 *
 * `renderPrintOverlay` tears its overlay down on `afterprint` (or after a 5 s
 * fallback) but the print helper functions intentionally stay fire-and-forget.
 * Button components that want a loading state can call this after triggering
 * the print: it resolves as soon as the overlay element is gone, so the spinner
 * covers the whole print session without changing the print pipeline API.
 */
const PRINT_OVERLAY_SELECTOR = '.shipping-label-print-root';
const POLL_INTERVAL_MS = 100;
/** Overlay fallback is 5 s; allow a little slack for slow tab teardown. */
const DEFAULT_TIMEOUT_MS = 6500;

export function isPrintOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector(PRINT_OVERLAY_SELECTOR) !== null;
}

export function waitForPrintOverlayToClose(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  if (!isPrintOverlayOpen()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (!isPrintOverlayOpen() || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        resolve();
      }
    }, POLL_INTERVAL_MS);
  });
}
