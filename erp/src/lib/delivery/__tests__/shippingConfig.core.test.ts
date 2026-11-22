import { describe, expect, it } from 'vitest';

import {
  SHIPPING_NOT_CONFIGURED_MESSAGE,
  resolveShippingChargeDecision,
} from '@/lib/delivery/shippingConfig.core';

/** ARGUS #292: missing rate card is not free shipping. */
describe('resolveShippingChargeDecision', () => {
  it('blocks when no active rate card exists', () => {
    expect(resolveShippingChargeDecision({ configured: false, shippingFee: '0.00' })).toEqual({
      status: 'not-configured',
      blocked: true,
      message: SHIPPING_NOT_CONFIGURED_MESSAGE,
    });
  });

  it('keeps a configured zero fee as genuine free shipping', () => {
    expect(resolveShippingChargeDecision({ configured: true, shippingFee: '0.00' })).toEqual({
      status: 'free',
      blocked: false,
    });
  });

  it('allows a configured positive fee', () => {
    expect(resolveShippingChargeDecision({ configured: true, shippingFee: 250 })).toEqual({
      status: 'charged',
      blocked: false,
    });
  });

  it('treats an unparseable configured fee as free rather than blocking', () => {
    expect(resolveShippingChargeDecision({ configured: true, shippingFee: 'n/a' })).toEqual({
      status: 'free',
      blocked: false,
    });
  });
});
