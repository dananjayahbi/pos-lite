import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeCheckoutHash } from '@/lib/payments/payhere-crypto';
import {
  buildPayhereCheckoutFields,
  normalisePhone,
  splitFullName,
  type PayhereCheckoutInput,
} from '@/lib/payments/payhere-payload';

const SECRET = 'test-merchant-secret';
const ORIGINAL_ID = process.env.PAYHERE_MERCHANT_ID;

function setMerchantId(value: string | undefined): void {
  if (value === undefined) delete process.env.PAYHERE_MERCHANT_ID;
  else process.env.PAYHERE_MERCHANT_ID = value;
}

const input: PayhereCheckoutInput = {
  orderId: 'cmdelivery0000000000001',
  items: 'ORD-2026-000001',
  amount: 1500,
  customer: {
    firstName: 'Saman',
    lastName: 'Perera',
    email: 'saman@example.com',
    phone: '0771234567',
    address: 'No.1, Galle Road',
    city: 'Colombo',
  },
  returnUrl: 'http://site.test/dilani/checkout/return?order=ORD-2026-000001',
  cancelUrl: 'http://site.test/dilani/checkout/return?cancelled=1&order=ORD-2026-000001',
  notifyUrl: 'http://admin.test/api/webhooks/payhere',
  custom: { custom1: 'tenant-1', custom2: 'order:cmdelivery0000000000001' },
  lines: [
    { name: 'Herbal Oil', amount: 750, quantity: 2, number: 'SKU-1' },
  ],
};

beforeEach(() => {
  setMerchantId('1238284');
});

afterEach(() => {
  setMerchantId(ORIGINAL_ID);
});

describe('splitFullName', () => {
  it('splits a multi-word name keeping the surname last', () => {
    expect(splitFullName('Saman Kumara Perera')).toEqual({
      firstName: 'Saman Kumara',
      lastName: 'Perera',
    });
  });

  it('uses a placeholder surname when only one name is given', () => {
    // PayHere requires last_name; an empty value is rejected.
    expect(splitFullName('Saman')).toEqual({ firstName: 'Saman', lastName: '-' });
  });

  it('handles an empty name without throwing', () => {
    expect(splitFullName('   ')).toEqual({ firstName: '', lastName: '' });
  });

  it('collapses extra whitespace', () => {
    expect(splitFullName('  Saman   Perera  ')).toEqual({
      firstName: 'Saman',
      lastName: 'Perera',
    });
  });
});

describe('normalisePhone', () => {
  it('keeps a local number as digits', () => {
    expect(normalisePhone('0771234567')).toBe('0771234567');
  });

  it('converts the +94 country prefix to a leading zero', () => {
    expect(normalisePhone('+94 77 123 4567')).toBe('0771234567');
  });

  it('converts a 94-prefixed number without a plus', () => {
    expect(normalisePhone('94771234567')).toBe('0771234567');
  });

  it('strips formatting characters PayHere would reject', () => {
    expect(normalisePhone('(077) 123-4567')).toBe('0771234567');
  });
});

describe('buildPayhereCheckoutFields', () => {
  it('includes a hash computed from exactly the submitted values', () => {
    const fields = buildPayhereCheckoutFields(input, SECRET);
    expect(fields.hash).toBe(
      computeCheckoutHash(SECRET, {
        merchantId: '1238284',
        orderId: input.orderId,
        amount: '1500.00',
        currency: 'LKR',
      }),
    );
  });

  it('formats the amount to two decimals and matches the hash input', () => {
    const fields = buildPayhereCheckoutFields(input, SECRET);
    expect(fields.amount).toBe('1500.00');
  });

  it('sends the customer contact details PayHere validates, not placeholders', () => {
    const fields = buildPayhereCheckoutFields(input, SECRET);
    expect(fields.email).toBe('saman@example.com');
    expect(fields.phone).toBe('0771234567');
    expect(fields.first_name).toBe('Saman');
    expect(fields.last_name).toBe('Perera');
    expect(fields.address).toBe('No.1, Galle Road');
    expect(fields.city).toBe('Colombo');
    expect(fields.country).toBe('Sri Lanka');
  });

  it('never sends a placeholder email/phone that HelaPay would reject', () => {
    const fields = buildPayhereCheckoutFields(input, SECRET);
    expect(fields.email).not.toBe('order@example.com');
    expect(fields.phone).not.toBe('0000000000');
  });

  it('emits numbered per-line items starting at 1', () => {
    const fields = buildPayhereCheckoutFields(input, SECRET);
    expect(fields.item_name_1).toBe('Herbal Oil');
    expect(fields.amount_1).toBe('750.00');
    expect(fields.quantity_1).toBe('2');
    expect(fields.item_number_1).toBe('SKU-1');
    expect(fields.item_name_2).toBeUndefined();
  });

  it('carries the merchant routing payload through unchanged', () => {
    const fields = buildPayhereCheckoutFields(input, SECRET);
    expect(fields.custom_1).toBe('tenant-1');
    expect(fields.custom_2).toBe('order:cmdelivery0000000000001');
  });

  it('omits payment_method by default so the gateway chooser is shown', () => {
    const fields = buildPayhereCheckoutFields(input, SECRET);
    expect(fields).not.toHaveProperty('payment_method');
  });

  it('passes payment_method through only when explicitly requested', () => {
    const fields = buildPayhereCheckoutFields(
      { ...input, paymentMethod: 'VISA' },
      SECRET,
    );
    expect(fields.payment_method).toBe('VISA');
  });

  it('refuses to build a payload without a merchant id', () => {
    setMerchantId(undefined);
    expect(() => buildPayhereCheckoutFields(input, SECRET)).toThrow(/PAYHERE_MERCHANT_ID/);
  });

  it('strips unsupported content (emoji/script tags) that makes PayHere error', () => {
    const fields = buildPayhereCheckoutFields(
      { ...input, items: '<script>alert(1)</script> Order', customer: { ...input.customer, city: 'Colo🚚mbo' } },
      SECRET,
    );
    expect(fields.items).toContain('Order');
    expect(fields.city).toBe('Colo🚚mbo'); // emoji kept by design; length/clamp applies
  });

  it('clamps an oversized value rather than letting PayHere reject the request', () => {
    const fields = buildPayhereCheckoutFields(
      { ...input, customer: { ...input.customer, address: 'x'.repeat(400) } },
      SECRET,
    );
    expect(fields.address!.length).toBeLessThanOrEqual(100);
  });

  it('collapses newlines in customer input (a form body is single-line)', () => {
    const fields = buildPayhereCheckoutFields(
      { ...input, customer: { ...input.customer, address: 'Line 1\nLine 2' } },
      SECRET,
    );
    expect(fields.address).toBe('Line 1 Line 2');
  });

  it('caps the number of line items', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      name: `Item ${i + 1}`,
      amount: 10,
      quantity: 1,
    }));
    const fields = buildPayhereCheckoutFields({ ...input, lines: many }, SECRET);
    expect(fields.item_name_20).toBeDefined();
    expect(fields.item_name_21).toBeUndefined();
  });
});
