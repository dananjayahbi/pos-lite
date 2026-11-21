import { describe, expect, it } from 'vitest';

import {
  findDuplicateSupplierName,
  normalizeSupplierName,
} from '@/lib/services/supplierDuplicateName.core';

/** ARGUS #235: same-name suppliers are a soft warning, computed on create+update. */
describe('normalizeSupplierName', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeSupplierName('  Lanka   Textile  ')).toBe('lanka textile');
  });
});

describe('findDuplicateSupplierName', () => {
  const live = [
    { id: 'sup_1', name: 'Lanka Textile Mills' },
    { id: 'sup_2', name: 'Colombo Fashion Imports' },
  ];

  it('matches an exact live name', () => {
    expect(findDuplicateSupplierName('Lanka Textile Mills', live)).toEqual({
      duplicateName: true,
      matchedSupplierId: 'sup_1',
      matchedName: 'Lanka Textile Mills',
    });
  });

  it('matches case and whitespace variants', () => {
    expect(findDuplicateSupplierName('  lanka   textile mills ', live).duplicateName).toBe(true);
  });

  it('reports no duplicate for a distinct name', () => {
    expect(findDuplicateSupplierName('Kandy Spice Traders', live)).toEqual({
      duplicateName: false,
      matchedSupplierId: null,
      matchedName: null,
    });
  });

  it('excludes the supplier being renamed so an update does not match itself', () => {
    expect(
      findDuplicateSupplierName('Lanka Textile Mills', live, 'sup_1').duplicateName,
    ).toBe(false);
  });

  it('still matches a different supplier when the current one is excluded', () => {
    const twoSame = [...live, { id: 'sup_3', name: 'lanka textile mills' }];
    expect(findDuplicateSupplierName('Lanka Textile Mills', twoSame, 'sup_1')).toMatchObject({
      duplicateName: true,
      matchedSupplierId: 'sup_3',
    });
  });

  it('does not warn on an empty name', () => {
    expect(findDuplicateSupplierName('   ', live).duplicateName).toBe(false);
  });
});
