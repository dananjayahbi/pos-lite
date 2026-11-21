import { describe, expect, it } from 'vitest';

import {
  buildThermalReceiptHtml,
  type ReceiptSale,
  type ReceiptTenant,
} from '@/lib/receipt-renderer';

const dec = (value: number) => ({ toString: () => value.toFixed(2) });

function makeSale(overrides: Partial<ReceiptSale> = {}): ReceiptSale {
  return {
    id: 'sale-1234567890',
    subtotal: dec(1065),
    discountAmount: dec(0),
    taxAmount: dec(191.7),
    totalAmount: dec(1256.7),
    changeGiven: null,
    paymentMethod: 'CASH',
    createdAt: new Date(2026, 10, 14, 16, 13),
    lines: [
      {
        productNameSnapshot: 'Bhringraj Hair Oil',
        variantDescriptionSnapshot: 'OIL / 100ml',
        quantity: 1,
        unitPrice: dec(1065),
        discountPercent: dec(0),
        discountAmount: dec(0),
        lineTotalBeforeDiscount: dec(1065),
        lineTotalAfterDiscount: dec(1065),
      },
    ],
    payments: [{ method: 'CASH', amount: dec(1256.7) }],
    ...overrides,
  };
}

function makeTenant(overrides: Partial<ReceiptTenant> = {}): ReceiptTenant {
  return {
    name: 'Ruhunu Wedagedara',
    settings: {
      address: '12 Galle Road, Matara',
      phoneNumber: '077 123 4567',
      receiptFooter: 'Thank you for shopping with us!',
    },
    ...overrides,
  };
}

/**
 * ARGUS #472: the sale's own fields are snapshotted (line name/price/tax), but
 * the store identity comes from the current tenant. A reprint says so.
 */
describe('buildThermalReceiptHtml identity caveat', () => {
  it('does not caveat an original print', () => {
    const html = buildThermalReceiptHtml(makeSale(), makeTenant(), 'Nimal');
    expect(html).not.toContain('Reprint - store details');
  });

  it('adds the caveat to a reprint', () => {
    const html = buildThermalReceiptHtml(makeSale(), makeTenant(), 'Nimal', {
      isReprint: true,
    });
    expect(html).toContain('Reprint - store details reflect the current profile');
  });

  it('keeps the sale line snapshot and the snapshot tax amount on a reprint', () => {
    const html = buildThermalReceiptHtml(
      makeSale(),
      makeTenant({ name: 'Renamed Store' }),
      'Nimal',
      { isReprint: true },
    );

    expect(html).toContain('Bhringraj Hair Oil');
    expect(html).toContain('OIL / 100ml');
    expect(html).toContain('Rs. 191.70');
    // The identity is intentionally current; the caveat makes that explicit.
    expect(html).toContain('Renamed Store');
  });
});
