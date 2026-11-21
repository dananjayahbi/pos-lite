import { describe, expect, it } from 'vitest';

import {
  findNearDuplicateCategoryName,
  normalizeCategoryName,
} from '@/lib/categories/categoryName.core';

/** ARGUS #173: near-duplicate category names must be rejected server-side. */
describe('category name normalisation', () => {
  it('trims, collapses internal whitespace and lower-cases', () => {
    expect(normalizeCategoryName('  Ayurvedic   Oils  ')).toBe('ayurvedic oils');
    expect(normalizeCategoryName('AYURVEDIC OILS')).toBe('ayurvedic oils');
  });

  it('finds case and whitespace variants of an existing category', () => {
    const existing = [{ id: 'cat-1', name: 'Ayurvedic Oils' }];

    expect(findNearDuplicateCategoryName('ayurvedic oils', existing)?.id).toBe('cat-1');
    expect(findNearDuplicateCategoryName('  Ayurvedic   Oils ', existing)?.id).toBe(
      'cat-1',
    );
  });

  it('allows a genuinely different name', () => {
    const existing = [{ id: 'cat-1', name: 'Ayurvedic Oils' }];
    expect(findNearDuplicateCategoryName('Ayurvedic Balms', existing)).toBeNull();
  });

  it('excludes the category being renamed', () => {
    const existing = [{ id: 'cat-1', name: 'Ayurvedic Oils' }];
    expect(findNearDuplicateCategoryName('ayurvedic oils', existing, 'cat-1')).toBeNull();
  });

  it('never treats a blank name as a duplicate', () => {
    const existing = [{ id: 'cat-1', name: 'Ayurvedic Oils' }];
    expect(findNearDuplicateCategoryName('   ', existing)).toBeNull();
  });
});
