import { describe, it, expect } from 'vitest';
import { CreateSaleSchema } from '@/lib/validators/sale.validators';

const baseLine = [{ variantId: 'v1', quantity: 1, discountPercent: 0 }];

describe('CreateSaleSchema — mandatory customer (doc 32)', () => {
  it('accepts a sale with a linked customerId', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a sale without a customerId', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('customerId'))).toBe(true);
    }
  });

  it('accepts a management sale without a shiftId', () => {
    const parsed = CreateSaleSchema.safeParse({
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts LANKAQR as a payment method', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'LANKAQR',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a SPLIT payment with a LankaQR leg', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'SPLIT',
      cardAmount: 40,
      cashReceived: 100,
      splitLegMethod: 'LANKAQR',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a SPLIT payment with a Card leg', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'SPLIT',
      cardAmount: 40,
      cashReceived: 100,
      splitLegMethod: 'CARD',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('CreateSaleSchema — zero-value reason (docs 33 & 34)', () => {
  it('accepts a zero-value sale with NONE payment and a BANK_PAYMENT reason', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      zeroValueReason: 'BANK_PAYMENT',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a zero-value sale with a COMPLIMENTARY_GIFT reason', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      zeroValueReason: 'COMPLIMENTARY_GIFT',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a PRODUCT_REPLACEMENT sale without a linked order reference', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      zeroValueReason: 'PRODUCT_REPLACEMENT',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('zeroValueLinkedOrderRef'))).toBe(
        true,
      );
    }
  });

  it('accepts a PRODUCT_REPLACEMENT sale with a linked order reference', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      zeroValueReason: 'PRODUCT_REPLACEMENT',
      zeroValueLinkedOrderRef: 'cm-abc123',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown zeroValueReason value', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      zeroValueReason: 'NOT_A_REASON',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(false);
  });
});
