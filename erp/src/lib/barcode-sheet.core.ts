/**
 * Pagination maths for the A4 barcode-printing sheet.
 *
 * The operator queues variants (with a copy count each); this module turns that
 * queue into A4 sheets. Keeping it pure means the preview, the print overlay
 * and the tests all agree on the page count — a mismatch between what the
 * preview shows and what the printer emits is the classic label-printing bug.
 */

import { getBarcodeLabelTemplate } from '@/lib/barcode-label-templates.core';

// The A4 grid comes from the shared template definition (ARGUS #157), so the
// sheet maths, the dialog and the standalone page cannot drift apart again.
const A4_TEMPLATE = getBarcodeLabelTemplate('a4-24up');

/** Fixed A4 label grid: 3 columns x 8 rows = 24 labels per sheet. */
export const BARCODE_SHEET_COLUMNS = A4_TEMPLATE.columns;
export const BARCODE_SHEET_ROWS = A4_TEMPLATE.rows;
export const BARCODE_LABELS_PER_SHEET =
  A4_TEMPLATE.labelsPerPage ?? BARCODE_SHEET_COLUMNS * BARCODE_SHEET_ROWS;

export interface SheetQueueItem {
  /** Number of copies to print for this variant. */
  copies: number;
}

/**
 * Expands the queue by copy count and chunks it into A4 sheets.
 *
 * `fillLastSheet` repeats the queue in order until the final sheet is full,
 * which is what "fill the A4 sheet with barcodes" means in practice: the
 * operator adds one variant and asks for a whole sheet of it.
 */
export function paginateBarcodeSheet<T extends SheetQueueItem>(
  items: readonly T[],
  options: { perSheet?: number; fillLastSheet?: boolean } = {},
): T[][] {
  const perSheet = Math.max(1, Math.floor(options.perSheet ?? BARCODE_LABELS_PER_SHEET));

  const expanded: T[] = [];
  for (const item of items) {
    const copies = Math.max(0, Math.floor(item.copies));
    for (let i = 0; i < copies; i++) expanded.push(item);
  }

  if (expanded.length === 0) return [];

  if (options.fillLastSheet) {
    const remainder = expanded.length % perSheet;
    if (remainder !== 0) {
      const missing = perSheet - remainder;
      for (let i = 0; i < missing; i++) {
        expanded.push(expanded[i % expanded.length]!);
      }
    }
  }

  const pages: T[][] = [];
  for (let i = 0; i < expanded.length; i += perSheet) {
    pages.push(expanded.slice(i, i + perSheet));
  }
  return pages;
}

/** Total labels that will be printed for the current queue. */
export function countBarcodeLabels<T extends SheetQueueItem>(
  items: readonly T[],
  options: { fillLastSheet?: boolean } = {},
): number {
  const pages = paginateBarcodeSheet(items, options);
  return pages.reduce((total, page) => total + page.length, 0);
}
