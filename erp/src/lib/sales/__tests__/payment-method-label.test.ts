import { describe, expect, it } from 'vitest';

import { paymentMethodLabel } from '@/lib/sales/payment-method-label';

describe('payment method labels (ARGUS #89)', () => {
  it('labels the zero-value NONE method', () => {
    expect(paymentMethodLabel('NONE')).toBe('None');
  });

  it('labels store and exchange credit the same way on every surface', () => {
    expect(paymentMethodLabel('STORE_CREDIT')).toBe('Store Credit');
    expect(paymentMethodLabel('EXCHANGE_CREDIT')).toBe('Exchange Credit');
  });

  it('keeps unknown enum values readable and blanks as a dash', () => {
    expect(paymentMethodLabel('LANKAQR')).toBe('LankaQR');
    expect(paymentMethodLabel(null)).toBe('-');
  });
});
