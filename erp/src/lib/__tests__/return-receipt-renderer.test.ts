import { describe, expect, it } from 'vitest';

import {
  buildReturnReceiptHtml,
  type ReceiptReturn,
  type ReceiptTenant,
} from '../return-receipt-renderer';

const dec = (value: number) => ({ toString: () => value.toFixed(2) });

function makeReturn(overrides: Partial<ReceiptReturn> = {}): ReceiptReturn {
  return {
    id: 'c0ffee1234567890abcdef',
    originalSaleId: '5a1e00009999',
    refundMethod: 'CASH',
    refundAmount: dec(2084),
    restockItems: true,
    reason: 'Wrong shade',
    createdAt: new Date(2026, 10, 14, 16, 13),
    lines: [
      {
        productNameSnapshot: 'Bhringraj Hair Oil',
        variantDescriptionSnapshot: 'OIL / 100ml',
        quantity: 1,
        unitPrice: dec(2084),
        lineRefundAmount: dec(2084),
        isRestocked: true,
      },
    ],
    ...overrides,
  };
}

function makeTenant(overrides: Partial<ReceiptTenant> = {}): ReceiptTenant {
  return {
    name: 'Ruhunu Wedagedara',
    logoUrl: null,
    settings: {
      address: '12 Galle Road, Matara',
      phoneNumber: '077 123 4567',
      receiptFooter: 'Thank you for shopping with us!',
    },
    ...overrides,
  };
}

describe('buildReturnReceiptHtml', () => {
  it('shows the tax refunded and the original sale total (ARGUS #90)', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({
        refundAmount: dec(2459.12),
        taxAmount: dec(375.12),
        originalSale: {
          totalAmount: dec(2934.12),
          taxAmount: dec(375.12),
          deliveryCharge: dec(475),
        },
      }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain('Tax refunded');
    expect(html).toContain('Rs. 375.12');
    expect(html).toContain('Original sale total');
    expect(html).toContain('Rs. 2,934.12');
    expect(html).toContain('Rs. 2,459.12');
  });

  it('omits the tax and sale-total rows when they are not available', () => {
    const html = buildReturnReceiptHtml(makeReturn(), makeTenant(), 'Nimal', 'Kamal');

    expect(html).not.toContain('Tax refunded');
    expect(html).not.toContain('Original sale total');
  });

  it('targets A4 portrait at a 180 mm content width instead of the old 80 mm slip', () => {
    const html = buildReturnReceiptHtml(makeReturn(), makeTenant(), 'Nimal', 'Kamal');

    expect(html).toContain('@page { size: A4 portrait; margin: 10mm; }');
    expect(html).toContain('width: 180mm');
    expect(html).not.toContain('width: 80mm');
    expect(html).not.toContain('size: 80mm');
  });

  it('renders the tenant logo when one is configured', () => {
    const html = buildReturnReceiptHtml(
      makeReturn(),
      makeTenant({ logoUrl: 'https://cdn.example.com/logo.png' }),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain('class="brand-logo"');
    expect(html).toContain('src="https://cdn.example.com/logo.png"');
    expect(html).not.toContain('brand-logo brand-monogram');
  });

  it('falls back to a monogram with the store initials when no logo exists', () => {
    const html = buildReturnReceiptHtml(makeReturn(), makeTenant(), 'Nimal', 'Kamal');

    expect(html).toContain('brand-monogram');
    expect(html).toContain('>RW</div>');
  });

  it('shows the store profile details, return ref and timestamp', () => {
    const html = buildReturnReceiptHtml(makeReturn(), makeTenant(), 'Nimal', 'Kamal');

    expect(html).toContain('Ruhunu Wedagedara');
    expect(html).toContain('12 Galle Road, Matara');
    expect(html).toContain('Tel: 077 123 4567');
    expect(html).toContain('C0FFEE12');
    expect(html).toContain('5A1E0000');
    expect(html).toContain('14/11/2026');
    expect(html).toContain('16:13');
  });

  it('lists returned items with quantity, unit price and refund amount', () => {
    const html = buildReturnReceiptHtml(makeReturn(), makeTenant(), 'Nimal', 'Kamal');

    expect(html).toContain('Bhringraj Hair Oil');
    expect(html).toContain('OIL / 100ml');
    expect(html).toContain('Rs. 2,084.00');
    expect(html).toContain('Total Refund');
    expect(html).toContain('1 item on 1 line');
  });

  it('escapes tenant and return text so receipt HTML cannot be injected', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({
        reason: '<script>alert(1)</script>',
        lines: [
          {
            productNameSnapshot: '<img src=x onerror=alert(1)>',
            variantDescriptionSnapshot: '"quoted" & <b>bold</b>',
            quantity: 1,
            unitPrice: dec(10),
            lineRefundAmount: dec(10),
            isRestocked: false,
          },
        ],
      }),
      makeTenant({ name: 'Shop <b>' }),
      'Cashier "One"',
      'Manager & Co',
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('Shop &lt;b&gt;');
    expect(html).toContain('Cashier &quot;One&quot;');
    expect(html).toContain('Manager &amp; Co');
  });

  it('escapes the logo URL before placing it in the src attribute', () => {
    const html = buildReturnReceiptHtml(
      makeReturn(),
      makeTenant({ logoUrl: 'https://cdn.example.com/a"onmouseover="alert(1).png' }),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain('a&quot;onmouseover=&quot;alert(1).png');
    expect(html).not.toContain('a"onmouseover="alert(1).png');
  });

  it('labels each refund method and explains it truthfully', () => {
    const cases: Array<[ReceiptReturn['refundMethod'], string, string]> = [
      ['CASH', 'Cash Refund', 'handed back'],
      ['CARD_REVERSAL', 'Card Reversal', 'original card/QR'],
      ['STORE_CREDIT', 'Store Credit', 'store-credit balance'],
      ['EXCHANGE', 'Exchange', 'exchanged'],
    ];

    for (const [method, label, detail] of cases) {
      const html = buildReturnReceiptHtml(
        makeReturn({ refundMethod: method }),
        makeTenant(),
        'Nimal',
        'Kamal',
      );
      expect(html, method).toContain(label);
      expect(html, method).toContain(detail);
    }
  });

  it('shows goods, tax and total refund plus the amount not refunded', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({
        refundAmount: dec(2459.12),
        taxAmount: dec(375.12),
        originalSale: { totalAmount: dec(2934.12), taxAmount: dec(375.12) },
      }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain('Goods refunded');
    expect(html).toContain('Rs. 2,084.00');
    expect(html).toContain('Tax refunded');
    expect(html).toContain('Rs. 375.12');
    expect(html).toContain('Original sale total');
    expect(html).toContain('Not refunded (original');
    expect(html).toContain('Rs. 475.00');
    expect(html).toContain('Rs. 2,459.12');
  });

  it('shows a zero tax row when the return recorded zero tax', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({ refundAmount: dec(100), taxAmount: dec(0) }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );
    expect(html).toContain('Tax refunded');
    expect(html).toContain('Rs. 0.00');
  });

  it('omits the not-refunded row on a full refund', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({
        refundAmount: dec(100),
        taxAmount: dec(0),
        originalSale: { totalAmount: dec(100) },
      }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );
    expect(html).not.toContain('Not refunded (original');
  });

  it('uses the original QR tender for a card reversal, not "original card"', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({
        refundMethod: 'CARD_REVERSAL',
        originalSale: {
          totalAmount: dec(2084),
          paymentMethod: 'LANKAQR',
          payments: [{ method: 'LANKAQR' }],
        },
      }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain('original LankaQR payment channel');
    expect(html).not.toContain('original card payment channel');
  });

  it('names the card tender when the original sale was paid by card', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({
        refundMethod: 'CARD_REVERSAL',
        originalSale: {
          totalAmount: dec(2084),
          paymentMethod: 'CARD',
          payments: [{ method: 'CARD' }],
        },
      }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain('original card payment channel');
  });

  it('does not promise a separate store-credit note or expiry', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({ refundMethod: 'STORE_CREDIT' }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain("customer's store-credit balance");
    expect(html).toContain('future purchase');
    expect(html).not.toContain('credit note was issued');
    expect(html).not.toContain('redeemed');
  });

  it('distinguishes fully, partially and not-restocked returns', () => {
    const line = makeReturn().lines[0]!;

    const all = buildReturnReceiptHtml(
      makeReturn({ lines: [line, { ...line, isRestocked: true }] }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );
    expect(all).toContain('All items returned to stock');
    expect(all).not.toContain('Not restocked');

    const partial = buildReturnReceiptHtml(
      makeReturn({
        lines: [line, { ...line, productNameSnapshot: 'Second', isRestocked: false }],
      }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );
    expect(partial).toContain('Partially returned to stock');
    expect(partial).toContain('Not restocked');

    const none = buildReturnReceiptHtml(
      makeReturn({ restockItems: false, lines: [{ ...line, isRestocked: false }] }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );
    expect(none).toContain('Not returned to stock');
  });

  it('keeps an explicit empty state when a return has no lines', () => {
    const html = buildReturnReceiptHtml(
      makeReturn({ lines: [], refundAmount: dec(0) }),
      makeTenant(),
      'Nimal',
      'Kamal',
    );

    expect(html).toContain('No item lines were recorded for this return.');
    expect(html).toContain('0 items on 0 lines');
  });

  it('prints the receipt footer, powered-by line and auto-print hook', () => {
    const html = buildReturnReceiptHtml(makeReturn(), makeTenant(), 'Nimal', 'Kamal');

    expect(html).toContain('Thank you for shopping with us!');
    expect(html).toContain('Powered by AyurPOS');
    expect(html).toContain('window.print()');
  });
});
