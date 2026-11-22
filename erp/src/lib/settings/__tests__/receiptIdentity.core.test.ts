import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RECEIPT_FOOTER,
  brandNamedInFooter,
  receiptContactLines,
  receiptFooterLines,
  receiptFooterNamesOtherBrand,
  receiptIdentityIssues,
  resolveReceiptFooter,
  splitReceiptLines,
} from '@/lib/settings/receiptIdentity.core';

const profile = {
  storeName: 'Ruhunu Weda Gedara',
  address: '12 Galle Road\nMatara',
  phoneNumber: '041 222 3344',
  receiptFooter: 'Thank you for shopping with us!',
};

/**
 * ARGUS #473: a live tenant must never print another business's brand. The
 * audit flags the exact shape the 07 suite left behind.
 */
describe('receipt identity audit', () => {
  it('reports no issues for a complete profile', () => {
    expect(receiptIdentityIssues(profile)).toEqual([]);
  });

  it('flags a footer that names a different business', () => {
    const issues = receiptIdentityIssues({
      ...profile,
      receiptFooter: 'Thank you for shopping at Ayur Wellness Centre!',
    });
    expect(issues.map((issue) => issue.code)).toEqual(['footer-other-brand']);
    expect(issues[0]?.message).toContain('Ayur Wellness Centre');
    expect(issues[0]?.message).toContain('Ruhunu Weda Gedara');
  });

  it('accepts a footer that names the tenant itself', () => {
    expect(
      receiptFooterNamesOtherBrand(
        'Ruhunu Weda Gedara',
        'Thank you for shopping at Ruhunu Weda Gedara!',
      ),
    ).toBe(false);
  });

  it('does not treat generic or free-form copy as another brand', () => {
    expect(receiptFooterNamesOtherBrand('Ruhunu Weda Gedara', 'Thank you for shopping with us!')).toBe(
      false,
    );
    expect(receiptFooterNamesOtherBrand('Ruhunu Weda Gedara', 'Wellness for the whole family')).toBe(
      false,
    );
  });

  it('flags missing footer, address and phone', () => {
    const issues = receiptIdentityIssues({
      storeName: 'Ruhunu Weda Gedara',
      address: '   ',
      phoneNumber: '',
      receiptFooter: '\n',
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      'footer-missing',
      'address-missing',
      'phone-missing',
    ]);
  });

  it('extracts a business name only from the shopping-at/with shape', () => {
    expect(brandNamedInFooter('Thank you for shopping at Ayur Wellness Centre!')).toBe(
      'Ayur Wellness Centre',
    );
    expect(brandNamedInFooter('Thank you for shopping with us!')).toBeNull();
    expect(brandNamedInFooter('See you again soon')).toBeNull();
  });
});

describe('shared receipt footer and contact policy', () => {
  it('falls back to one footer everywhere when the saved footer is blank', () => {
    expect(resolveReceiptFooter('')).toBe(DEFAULT_RECEIPT_FOOTER);
    expect(resolveReceiptFooter('   \n ')).toBe(DEFAULT_RECEIPT_FOOTER);
    expect(resolveReceiptFooter('Thank you')).toBe('Thank you');
  });

  it('keeps a multi-line footer', () => {
    expect(receiptFooterLines('Thank you\r\nCome again')).toEqual(['Thank you', 'Come again']);
  });

  it('prints address lines, then one phone line', () => {
    expect(
      receiptContactLines({
        address: '12 Galle Road\r\nMatara',
        phoneNumber: ' 041 222 3344 ',
      }),
    ).toEqual(['12 Galle Road', 'Matara', 'Tel: 041 222 3344']);
  });

  it('omits blank contact fields instead of printing empty lines', () => {
    expect(receiptContactLines({ address: '', phoneNumber: '  ' })).toEqual([]);
  });

  it('splits stored text on CR, LF and CRLF and trims each line', () => {
    expect(splitReceiptLines(' a \r\n b \r c \n\n')).toEqual(['a', 'b', 'c']);
  });
});
