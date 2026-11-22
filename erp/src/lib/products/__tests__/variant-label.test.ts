import { describe, expect, it } from 'vitest';

import {
  appendVariantLabel,
  formatVariantLabel,
  VARIANT_LABEL_SEPARATOR,
  VARIANT_PART_SEPARATOR,
} from '@/lib/products/variant-label';

/**
 * ARGUS #150: SKU/name and form/pack size ran together in the movement ledger
 * (`BAI-08-OIL-100MLOIL / 100ml`) and the dashboard stock table
 * (`Mahanarayan OilOIL / 500ml`) because only a CSS margin separated them.
 */
describe('variant labels', () => {
  it('joins form and pack size with an explicit separator', () => {
    expect(formatVariantLabel({ form: 'OIL', packSize: '100ml' })).toBe(
      `OIL${VARIANT_PART_SEPARATOR}100ml`,
    );
  });

  it('drops missing parts without leaving a dangling separator', () => {
    expect(formatVariantLabel({ form: 'OIL', packSize: null })).toBe('OIL');
    expect(formatVariantLabel({ form: '', packSize: '500ml' })).toBe('500ml');
    expect(formatVariantLabel({})).toBe('');
    expect(formatVariantLabel({ form: '  ', packSize: '  ' })).toBe('');
  });

  it('separates the base label from the variant descriptor', () => {
    expect(appendVariantLabel('Mahanarayan Oil', { form: 'OIL', packSize: '500ml' })).toBe(
      `Mahanarayan Oil${VARIANT_LABEL_SEPARATOR}OIL / 500ml`,
    );
    expect(appendVariantLabel('BAI-08-OIL-100ML', { form: 'OIL', packSize: '100ml' })).toBe(
      `BAI-08-OIL-100ML${VARIANT_LABEL_SEPARATOR}OIL / 100ml`,
    );
  });

  it('returns the base alone when the variant has no descriptor', () => {
    expect(appendVariantLabel('Plain product', {})).toBe('Plain product');
    expect(appendVariantLabel('Plain product', { form: null, packSize: null })).toBe(
      'Plain product',
    );
  });
});
