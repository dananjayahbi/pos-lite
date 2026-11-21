import { describe, expect, it } from 'vitest';

import {
  lowStockAlertBody,
  lowStockAlertTitle,
  selectLowStockAlerts,
} from '@/lib/notifications/low-stock-alert';

const base = {
  variantId: 'variant-1',
  productName: 'Bhringraj Hair Oil',
  sku: 'OIL-100',
  stockQuantity: 5,
  lowStockThreshold: 5,
};

describe('selectLowStockAlerts (ARGUS #55)', () => {
  it('alerts when a sale crosses into low stock', () => {
    const selected = selectLowStockAlerts([{ ...base, previousQuantity: 7 }]);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.variantId).toBe('variant-1');
  });

  it('does not repeat the alert when the variant was already low', () => {
    expect(
      selectLowStockAlerts([{ ...base, stockQuantity: 3, previousQuantity: 4 }]),
    ).toEqual([]);
  });

  it('skips a disabled threshold (0 means alerts off)', () => {
    expect(
      selectLowStockAlerts([
        { ...base, stockQuantity: 0, lowStockThreshold: 0, previousQuantity: 1 },
      ]),
    ).toEqual([]);
  });

  it('skips stock that is still above the threshold', () => {
    expect(
      selectLowStockAlerts([{ ...base, stockQuantity: 6, previousQuantity: 8 }]),
    ).toEqual([]);
  });

  it('de-duplicates the same variant in one sale', () => {
    expect(
      selectLowStockAlerts([
        { ...base, previousQuantity: 7 },
        { ...base, previousQuantity: 6 },
      ]),
    ).toHaveLength(1);
  });

  it('keeps manual adjustments alerting even without a previous quantity', () => {
    expect(selectLowStockAlerts([base])).toHaveLength(1);
  });

  it('uses the same title/body as manual adjustments', () => {
    expect(lowStockAlertTitle(base)).toBe(
      'Bhringraj Hair Oil - OIL-100 is low on stock',
    );
    expect(lowStockAlertBody(base, 'Sold via sale ABC12345')).toBe(
      'Current stock: 5 units. Threshold: 5 units. Sold via sale ABC12345.',
    );
  });
});
