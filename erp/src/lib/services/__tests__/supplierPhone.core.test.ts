import { describe, expect, it } from 'vitest';

import {
  findSupplierPhoneClash,
  supplierPhoneKey,
} from '@/lib/services/supplierPhone.core';

/** ARGUS #236: format must not defeat the supplier phone uniqueness rule. */
describe('supplierPhoneKey', () => {
  it('maps both accepted formats to the same 94 key', () => {
    expect(supplierPhoneKey('+94771234567')).toBe('94771234567');
    expect(supplierPhoneKey('0771234567')).toBe('94771234567');
  });

  it('strips separators before keying', () => {
    expect(supplierPhoneKey('+94 77 123 4567')).toBe('94771234567');
    expect(supplierPhoneKey('077-123-4567')).toBe('94771234567');
    expect(supplierPhoneKey('(077) 123.4567')).toBe('94771234567');
  });

  it('leaves an already-canonical 94 number unchanged', () => {
    expect(supplierPhoneKey('94771234567')).toBe('94771234567');
  });

  it('keeps different numbers different', () => {
    expect(supplierPhoneKey('0771234567')).not.toBe(supplierPhoneKey('0771234568'));
  });
});

describe('findSupplierPhoneClash', () => {
  const rows = [
    { id: 'sup_1', phone: '0771234567', isActive: true },
    { id: 'sup_2', phone: '+94711111111', isActive: false },
  ];

  it('finds a live row stored in the other valid format', () => {
    expect(findSupplierPhoneClash('+94771234567', rows)).toEqual(rows[0]);
  });

  it('finds an archived row too (archived phones stay reserved)', () => {
    expect(findSupplierPhoneClash('0711111111', rows)).toEqual(rows[1]);
  });

  it('returns null for a genuinely new number', () => {
    expect(findSupplierPhoneClash('0779999999', rows)).toBeNull();
  });

  it('excludes the row being updated', () => {
    expect(findSupplierPhoneClash('0771234567', rows, 'sup_1')).toBeNull();
  });

  it('still finds a different row when the current one is excluded', () => {
    const twoSame = [...rows, { id: 'sup_3', phone: '+94 77 123 4567', isActive: true }];
    expect(findSupplierPhoneClash('0771234567', twoSame, 'sup_1')).toEqual(twoSame[2]);
  });
});
