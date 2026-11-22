import { describe, expect, it } from 'vitest';

import { netRevenueOnSameTaxBasis } from '@/lib/shifts/z-report-net-revenue';

describe('Z-report net revenue tax basis (ARGUS #117)', () => {
  it('subtracts refunds from sales on the same goods (tax-exclusive) basis', () => {
    // Reported case: 46,941.26 tax-inclusive sales with 2,459.12 tax;
    // 3,371.60 refund total that is pre-tax (legacy, taxAmount 0).
    const net = netRevenueOnSameTaxBasis({
      salesTotal: '46941.26',
      salesTax: '2459.12',
      refundTotal: '3371.60',
      refundTax: '0.00',
    });

    expect(net.toFixed(2)).toBe('41110.54');
    // The old formula (46941.26 - 3371.60 = 43569.66) mixed bases.
    expect(net.toFixed(2)).not.toBe('43569.66');
  });

  it('does not double-count tax on a tax-inclusive refund', () => {
    const net = netRevenueOnSameTaxBasis({
      salesTotal: '1180.00',
      salesTax: '180.00',
      refundTotal: '118.00',
      refundTax: '18.00',
    });

    // Goods: 1000.00 - 100.00
    expect(net.toFixed(2)).toBe('900.00');
  });

  it('rounds half-up to 2dp', () => {
    expect(
      netRevenueOnSameTaxBasis({
        salesTotal: '10.005',
        salesTax: '0',
        refundTotal: '0.001',
        refundTax: '0',
      }).toFixed(2),
    ).toBe('10.00');
  });

  it('can be negative when refunds exceed the shift sales', () => {
    expect(
      netRevenueOnSameTaxBasis({
        salesTotal: '100.00',
        salesTax: '0',
        refundTotal: '150.00',
        refundTax: '0',
      }).toFixed(2),
    ).toBe('-50.00');
  });
});
