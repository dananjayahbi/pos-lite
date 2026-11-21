import { describe, expect, it } from 'vitest';

import {
  deliveryPrintButtonState,
  deliveryPrintKey,
} from '@/components/delivery/printState';

describe('deliveryPrintKey', () => {
  it('keeps waybill and invoice actions distinct per row', () => {
    expect(deliveryPrintKey('waybill', 'd1')).toBe('waybill:d1');
    expect(deliveryPrintKey('invoice', 'd1')).toBe('invoice:d1');
  });
});

describe('deliveryPrintButtonState', () => {
  it('marks the row and action that is printing', () => {
    expect(deliveryPrintButtonState('waybill:d1', 'waybill', 'd1')).toEqual({
      isActive: true,
      isBusy: true,
    });
  });

  it('disables every other row while a print is active', () => {
    expect(deliveryPrintButtonState('waybill:d1', 'invoice', 'd1')).toEqual({
      isActive: false,
      isBusy: true,
    });
    expect(deliveryPrintButtonState('waybill:d1', 'waybill', 'd2')).toEqual({
      isActive: false,
      isBusy: true,
    });
  });

  it('is idle when nothing is printing', () => {
    expect(deliveryPrintButtonState(null, 'invoice', 'd1')).toEqual({
      isActive: false,
      isBusy: false,
    });
  });
});
