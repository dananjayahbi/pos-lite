import { describe, expect, it } from 'vitest';

import {
  pruneSelection,
  toggleAllVisible,
  toggleSelection,
  visibleSelectedIds,
} from '@/components/orders/selection';

const page = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

/**
 * ARGUS #264 - a delivered row selected before a PLACED filter must not stay
 * in the bulk action set just because it is no longer visible.
 */
describe('visibleSelectedIds', () => {
  it('keeps only rows on the current page, in display order', () => {
    expect(visibleSelectedIds(new Set(['c', 'a']), page)).toEqual(['a', 'c']);
  });

  it('drops selected ids that are hidden by the filter', () => {
    expect(visibleSelectedIds(new Set(['a', 'delivered-row']), page)).toEqual(['a']);
  });

  it('returns an empty list for an empty page', () => {
    expect(visibleSelectedIds(new Set(['a']), [])).toEqual([]);
  });
});

describe('pruneSelection', () => {
  it('removes ids that are no longer visible', () => {
    expect(Array.from(pruneSelection(new Set(['a', 'hidden']), page))).toEqual(['a']);
  });

  it('keeps a fully visible selection unchanged', () => {
    const selected = new Set(['a', 'b']);
    expect(Array.from(pruneSelection(selected, page))).toEqual(['a', 'b']);
  });

  it('returns an empty set when the refetch returns no rows', () => {
    expect(pruneSelection(new Set(['a']), []).size).toBe(0);
  });
});

describe('toggleSelection', () => {
  it('adds a row id', () => {
    expect(Array.from(toggleSelection(new Set(['a']), 'b'))).toEqual(['a', 'b']);
  });

  it('removes an already selected row id', () => {
    expect(Array.from(toggleSelection(new Set(['a', 'b']), 'a'))).toEqual(['b']);
  });

  it('does not mutate the input set', () => {
    const selected = new Set(['a']);
    toggleSelection(selected, 'b');
    expect(Array.from(selected)).toEqual(['a']);
  });
});

describe('toggleAllVisible', () => {
  it('selects every visible row', () => {
    expect(Array.from(toggleAllVisible(new Set(['hidden']), page))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('clears the page when every visible row is selected', () => {
    expect(toggleAllVisible(new Set(['a', 'b', 'c']), page).size).toBe(0);
  });

  it('does not select hidden ids as part of the page toggle', () => {
    const next = toggleAllVisible(new Set(['hidden']), page);
    expect(next.has('hidden')).toBe(false);
  });

  it('leaves an empty page empty', () => {
    expect(toggleAllVisible(new Set(['a']), []).size).toBe(0);
  });
});
