import { describe, expect, it } from 'vitest';

import {
  BARCODE_LABELS_PER_SHEET,
  countBarcodeLabels,
  paginateBarcodeSheet,
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
