'use client';

import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';

const PRINT_ROOT_CLASS = 'shipping-label-print-root';

/**
 * Renders arbitrary printable content into a full-screen overlay and triggers
 * the browser print dialog. Only the overlay content is printed; the rest of the
 * app is hidden via injected `@media print` CSS. Background colors and images are
 * forced to print regardless of the browser's "Background graphics" setting.
 *
 * Shared by the shipping label and the order/shipping invoice so all printable
 * documents use the same overlay + print pipeline.
 */
export function renderPrintOverlay(content: ReactNode): void {
  const overlay = document.createElement('div');
  overlay.className = PRINT_ROOT_CLASS;
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    background: '#ffffff',
    overflow: 'auto',
    padding: '16px',
  });
  document.body.appendChild(overlay);

  const root: Root = createRoot(overlay);
  // flushSync commits the content BEFORE the print dialog opens, otherwise the
  // browser may snapshot an empty overlay (createRoot.render is async).
  flushSync(() => {
    root.render(content);
  });

  const style = document.createElement('style');
  style.textContent = `@media print {
    body > *:not(.${PRINT_ROOT_CLASS}) { display: none !important; }
    .${PRINT_ROOT_CLASS} { display: block !important; position: static !important; overflow: visible !important; padding: 8px !important; }
  }
  /* Force background colors and images to print regardless of the browser's
     "Background graphics" print setting. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }`;
  document.head.appendChild(style);

  let fallback: number | undefined;
  const cleanup = () => {
    root.unmount();
    overlay.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
    if (fallback) window.clearTimeout(fallback);
  };
  fallback = window.setTimeout(cleanup, 5000);
  window.addEventListener('afterprint', cleanup);

  // Wait for images (e.g. the logo) to finish loading so they appear in the
  // print snapshot, then trigger the dialog.
  const images = Array.from(overlay.querySelectorAll('img'));
  const imagePromises = images.map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      }),
  );

  Promise.all(imagePromises).then(() => window.print());
}
