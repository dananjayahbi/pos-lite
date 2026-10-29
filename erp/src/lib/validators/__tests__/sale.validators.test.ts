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

  it('accepts an explicit guest (walk-in) sale with no customerId', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      isGuestSale: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a guest sale that tries to redeem store credit', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      isGuestSale: true,
      appliedStoreCredit: '25',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('appliedStoreCredit'))).toBe(true);
    }
  });

  it('accepts an optional deliveryCharge and an explicit saleDate', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 300,
      customerId: 'cust-1',
      deliveryCharge: 250,
      saleDate: '2026-01-15T12:00:00.000Z',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.deliveryCharge).toBe(250);
      expect(parsed.data.saleDate).toBeInstanceOf(Date);
    }
  });

  it('defaults deliveryCharge to 0 so POS totals are unchanged', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.deliveryCharge).toBe(0);
  });

  it('rejects a negative deliveryCharge', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      customerId: 'cust-1',
      deliveryCharge: -5,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a saleDate far in the future', () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      customerId: 'cust-1',
      saleDate: future,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('saleDate'))).toBe(true);
    }
  });

  it('rejects an absurdly old saleDate', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      customerId: 'cust-1',
      saleDate: '1900-01-01T00:00:00.000Z',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unparseable saleDate', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
      customerId: 'cust-1',
      saleDate: 'not-a-date',
    });
    expect(parsed.success).toBe(false);
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

  it('accepts a shiftless management sale without a customerId', () => {
    const parsed = CreateSaleSchema.safeParse({
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'CASH',
      cashReceived: 100,
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

  it('accepts a PRODUCT_REPLACEMENT sale with a linked order reference and defective barcode', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      zeroValueReason: 'PRODUCT_REPLACEMENT',
      zeroValueLinkedOrderRef: 'cm-abc123',
      defectiveBarcode: '931234567890',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(true);
  });

  // M14-04 (req 3.11 / D14): PRODUCT_REPLACEMENT now needs BOTH the order ref
  // and the defective item barcode.
  it('rejects a PRODUCT_REPLACEMENT sale without a defective barcode', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      zeroValueReason: 'PRODUCT_REPLACEMENT',
      zeroValueLinkedOrderRef: 'cm-abc123',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('defectiveBarcode'))).toBe(true);
    }
  });

  // M14-01 (BUG-44): NONE is not a client-selectable tender without a reason.
  it('rejects a NONE payment with no zeroValueReason', () => {
    const parsed = CreateSaleSchema.safeParse({
      shiftId: 'shift-1',
      lines: baseLine,
      cartDiscountAmount: 0,
      paymentMethod: 'NONE',
      customerId: 'cust-1',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('paymentMethod'))).toBe(true);
    }
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
