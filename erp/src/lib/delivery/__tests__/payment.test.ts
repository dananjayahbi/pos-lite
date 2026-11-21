import { describe, expect, it } from 'vitest';

import {
  describePayment,
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/lib/delivery/payment';

describe('paymentMethodLabel', () => {
  it('keeps COD as an acronym and title-cases card', () => {
    expect(paymentMethodLabel('COD')).toBe('COD');
    expect(paymentMethodLabel('cod')).toBe('COD');
    expect(paymentMethodLabel('CARD')).toBe('Card');
  });

  it('handles unknown enum values and blanks', () => {
    expect(paymentMethodLabel('BANK_TRANSFER')).toBe('Bank transfer');
    expect(paymentMethodLabel(null)).toBe('-');
    expect(paymentMethodLabel('  ')).toBe('-');
  });
});

describe('paymentStatusLabel', () => {
  it('title-cases the stored status', () => {
    expect(paymentStatusLabel('PAID')).toBe('Paid');
    expect(paymentStatusLabel('PENDING')).toBe('Pending');
    expect(paymentStatusLabel(undefined)).toBe('-');
  });
});

describe('describePayment (ARGUS #277)', () => {
  it('shows the method and status together beside COD', () => {
    expect(describePayment('COD', 'PAID')).toBe('COD · Paid');
    expect(describePayment('CARD', 'PENDING')).toBe('Card · Pending');
  });

  it('degrades to whichever half is recorded', () => {
    expect(describePayment('COD', null)).toBe('COD');
    expect(describePayment(null, 'PAID')).toBe('Paid');
    expect(describePayment(null, null)).toBe('-');
  });
});
