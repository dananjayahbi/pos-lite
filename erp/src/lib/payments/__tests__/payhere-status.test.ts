import { describe, it, expect } from 'vitest';
import { mapOrderPayhereStatus } from '@/lib/payments/payhere-status';
import { OrderPaymentStatus } from '@/generated/prisma/client';

describe('mapOrderPayhereStatus', () => {
  it('maps success (2) to PAID', () => {
    expect(mapOrderPayhereStatus(2)).toBe(OrderPaymentStatus.PAID);
  });

  it('maps pending (0) and failed (-2) to FAILED', () => {
    expect(mapOrderPayhereStatus(0)).toBe(OrderPaymentStatus.FAILED);
    expect(mapOrderPayhereStatus(-2)).toBe(OrderPaymentStatus.FAILED);
  });

  it('maps refund (-3) to REFUNDED', () => {
    expect(mapOrderPayhereStatus(-3)).toBe(OrderPaymentStatus.REFUNDED);
  });

  it('defaults unknown codes to FAILED', () => {
    expect(mapOrderPayhereStatus(99)).toBe(OrderPaymentStatus.FAILED);
    expect(mapOrderPayhereStatus(-1)).toBe(OrderPaymentStatus.FAILED);
  });
});
