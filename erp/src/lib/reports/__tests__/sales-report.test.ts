import { describe, it, expect } from 'vitest';

import {
  allocatePercentOfTotal,
  netUnitsSold,
  salesProductLabel,
  topRevenueProducts,
} from '@/lib/reports/sales-report';

describe('sales report labels and net units', () => {
  it('appends the variant so duplicate product bars are distinguishable', () => {
    const base = { productName: 'Bhringraj Hair Oil' };
    expect(
      salesProductLabel({ ...base, variantDescription: 'OIL / 100ml' }),
    ).toBe('Bhringraj Hair Oil - OIL / 100ml');
    expect(
      salesProductLabel({ ...base, variantDescription: 'OIL / 500ml' }),
    ).toBe('Bhringraj Hair Oil - OIL / 500ml');
  });

  it('falls back to the product name when there is no variant label', () => {
    expect(
      salesProductLabel({ productName: 'Brahmi Powder', variantDescription: '-' }),
    ).toBe('Brahmi Powder');
    expect(salesProductLabel({ productName: 'Brahmi Powder' })).toBe(
      'Brahmi Powder',
    );
  });

  it('reports units kept after returns', () => {
    expect(netUnitsSold(3, 1)).toBe(2);
    expect(netUnitsSold(2, 0)).toBe(2);
  });
});

describe('percent-of-total allocation (ARGUS #439)', () => {
  // The seeded report rows, whose independently rounded percentages summed to
  // 100.01% beside a hardcoded 100% footer.
  const seededAmounts = [3320, 2292, 1079, 887, 877, 670, 475, 206, 195, 0];

  it('reconciles rounded percentages to exactly 100.00', () => {
    const { percents, total } = allocatePercentOfTotal(seededAmounts);

    expect(total).toBe('100.00');
    expect(percents).toHaveLength(seededAmounts.length);
    const sum = percents.reduce((acc, value) => acc + Number(value), 0);
    expect(sum).toBeCloseTo(100, 10);
  });

  it('stays within one hundredth of a percent of plain rounding', () => {
    const { percents } = allocatePercentOfTotal(seededAmounts);
    const sum = seededAmounts.reduce((acc, value) => acc + value, 0);

    seededAmounts.forEach((amount, index) => {
      const plain = Number(((amount / sum) * 100).toFixed(2));
      const diffInHundredths = Math.round(
        Math.abs(Number(percents[index]) - plain) * 100,
      );
      expect(diffInHundredths).toBeLessThanOrEqual(1);
    });
    // The smallest remainders give up the hundredth; zero stays zero.
    expect(percents[0]).toBe('33.19');
    expect(percents[9]).toBe('0.00');
  });

  it('handles a zero total without dividing by zero', () => {
    expect(allocatePercentOfTotal([0, 0])).toEqual({
      percents: ['0.00', '0.00'],
      total: '0.00',
    });
    expect(allocatePercentOfTotal([])).toEqual({ percents: [], total: '0.00' });
  });

  it('keeps plain rounding when negative rows are present', () => {
    const result = allocatePercentOfTotal([150, -50]);
    const sum = result.percents.reduce((acc, value) => acc + Number(value), 0);

    expect(result.percents).toEqual(['150.00', '-50.00']);
    expect(Number(result.total)).toBeCloseTo(sum, 10);
  });
});

describe('top revenue products (ARGUS #439)', () => {
  it('drops zero and negative revenue rows and orders by revenue', () => {
    const products = [
      { name: 'Zero', netRevenue: '0.00' },
      { name: 'Small', netRevenue: '10.00' },
      { name: 'Negative', netRevenue: '-12.00' },
      { name: 'Large', netRevenue: '120.00' },
    ];

    expect(topRevenueProducts(products).map((p) => p.name)).toEqual([
      'Large',
      'Small',
    ]);
  });

  it('caps the list at the requested limit', () => {
    const products = Array.from({ length: 15 }, (_, index) => ({
      name: `P${index}`,
      netRevenue: String(index + 1),
    }));

    expect(topRevenueProducts(products).map((p) => p.name)).toEqual([
      'P14', 'P13', 'P12', 'P11', 'P10', 'P9', 'P8', 'P7', 'P6', 'P5',
    ]);
  });
});
