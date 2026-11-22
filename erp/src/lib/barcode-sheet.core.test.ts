import { describe, expect, it } from 'vitest';

import {
  BARCODE_LABELS_PER_SHEET,
  BARCODE_SHEET_COLUMNS,
  BARCODE_SHEET_ROWS,
  countBarcodeLabels,
  paginateBarcodeSheet,
  planBarcodeCopies,
} from '@/lib/barcode-sheet.core';

const item = (copies: number, id = `v-${copies}`) => ({ id, copies });

describe('paginateBarcodeSheet', () => {
  it('returns no pages for an empty queue', () => {
    expect(paginateBarcodeSheet([])).toEqual([]);
    expect(countBarcodeLabels([])).toBe(0);
  });

  it('expands copies and keeps everything on one page when it fits', () => {
    const pages = paginateBarcodeSheet([item(3, 'a'), item(2, 'b')]);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(5);
    expect(pages[0]!.map((entry) => entry.id)).toEqual(['a', 'a', 'a', 'b', 'b']);
  });

  it('fills an exact sheet without spilling', () => {
    const pages = paginateBarcodeSheet([item(BARCODE_LABELS_PER_SHEET)]);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(24);
  });

  it('adds another sheet when the queue overflows', () => {
    const pages = paginateBarcodeSheet([item(BARCODE_LABELS_PER_SHEET + 1)]);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(24);
    expect(pages[1]).toHaveLength(1);
  });

  it('splits the dialog 32-label A4 job after 24, not 32 (ARGUS #156)', () => {
    // The print dialog used to claim 4 × 8 = 32 labels per sheet, but 4 × 6 cm
    // labels only fit 4 rows on A4. The shared 3 × 8 grid is the truthful one.
    expect(BARCODE_SHEET_COLUMNS).toBe(3);
    expect(BARCODE_SHEET_ROWS).toBe(8);
    expect(BARCODE_LABELS_PER_SHEET).toBe(24);

    const pages = paginateBarcodeSheet([item(32, 'dialog')]);
    expect(pages.map((page) => page.length)).toEqual([24, 8]);
  });

  it('spreads many variants across pages in queue order', () => {
    const pages = paginateBarcodeSheet([item(20, 'a'), item(10, 'b')]);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(24);
    expect(pages[0]!.filter((entry) => entry.id === 'a')).toHaveLength(20);
    expect(pages[0]!.filter((entry) => entry.id === 'b')).toHaveLength(4);
    expect(pages[1]).toHaveLength(6);
    expect(pages[1]!.every((entry) => entry.id === 'b')).toBe(true);
  });

  it('cycle-fills the last sheet when asked', () => {
    const pages = paginateBarcodeSheet([item(30, 'a')], { fillLastSheet: true });
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(24);
    expect(pages[1]).toHaveLength(24);
    expect(pages[1]!.every((entry) => entry.id === 'a')).toBe(true);
    expect(countBarcodeLabels([item(30)], { fillLastSheet: true })).toBe(48);
  });

  it('ignores zero and negative copies', () => {
    expect(paginateBarcodeSheet([item(0), { id: 'neg', copies: -3 }])).toEqual([]);
  });

  it('honours a custom per-sheet capacity', () => {
    const pages = paginateBarcodeSheet([item(5)], { perSheet: 2 });
    expect(pages.map((page) => page.length)).toEqual([2, 2, 1]);
  });
});

/**
 * ARGUS #162: with Fill last sheet on, the header total jumped from 25 to 48
 * while each queue row still said 25, so the row no longer stated how many
 * labels it would print.
 */
describe('planBarcodeCopies', () => {
  it('reports the requested count per row when no filling is needed', () => {
    const plan = planBarcodeCopies([item(20, 'a'), item(5, 'b')]);
    expect(plan.requested).toBe(25);
    expect(plan.printed).toEqual([20, 5]);
    expect(plan.total).toBe(25);
    expect(plan.filler).toBe(0);
  });

  it('attributes sheet filler back to the rows that will print it', () => {
    const plan = planBarcodeCopies([item(20, 'a'), item(5, 'b')], {
      fillLastSheet: true,
    });
    expect(plan.requested).toBe(25);
    expect(plan.filler).toBe(23);
    expect(plan.total).toBe(48);
    // Queue order: 20 a + 5 b, then the first 20 a and 3 b repeat.
    expect(plan.printed).toEqual([40, 8]);
    expect(plan.printed.reduce((sum, value) => sum + value, 0)).toBe(plan.total);
  });

  it('adds no filler for an exactly full sheet', () => {
    const plan = planBarcodeCopies([item(BARCODE_LABELS_PER_SHEET, 'a')], {
      fillLastSheet: true,
    });
    expect(plan.filler).toBe(0);
    expect(plan.total).toBe(BARCODE_LABELS_PER_SHEET);
    expect(plan.printed).toEqual([BARCODE_LABELS_PER_SHEET]);
  });

  it('handles an empty queue', () => {
    expect(planBarcodeCopies([])).toEqual({
      requested: 0,
      printed: [],
      total: 0,
      filler: 0,
    });
  });
});
