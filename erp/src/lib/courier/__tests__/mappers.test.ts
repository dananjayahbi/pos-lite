import { describe, it, expect } from 'vitest';
import { transExpressMapStatus } from '@/lib/courier/trans-express/adapter';
import { toCourierOrderPayload } from '@/lib/courier/mappers';
import { isDeliveryStatusAdvance } from '@/lib/constants/courier';

describe('transExpressMapStatus', () => {
  it('maps a raw delivered status to DELIVERED', () => {
    expect(transExpressMapStatus('delivered')).toEqual({
      shipment: 'DELIVERED',
      delivery: 'DELIVERED',
    });
  });

  it('normalizes case-insensitively', () => {
    expect(transExpressMapStatus('Out for Delivery').delivery).toBe('OUT_FOR_DELIVERY');
  });

  it('normalizes snake_case and hyphenated carrier statuses', () => {
    expect(transExpressMapStatus('in_transit').delivery).toBe('IN_TRANSIT');
    expect(transExpressMapStatus('returned-to-branch').delivery).toBe('RETURNED');
    expect(transExpressMapStatus('delivery_failed').delivery).toBe('FAILED');
  });

  it('defaults unknown statuses to PROCESSING / IN_TRANSIT', () => {
    expect(transExpressMapStatus('some-unknown-state')).toEqual({
      shipment: 'PROCESSING',
      delivery: 'IN_TRANSIT',
    });
  });

  it('treats undefined as in-transit', () => {
    expect(transExpressMapStatus(undefined).delivery).toBe('IN_TRANSIT');
  });
});

describe('toCourierOrderPayload', () => {
  const address = {
    fullName: 'John Doe',
    phone: '0771234567',
    addressLine1: '12 Main St',
    cityId: 5,
    districtId: 2,
  };
  const delivery = { orderRef: 'ORD-1', codAmount: { toString: () => '1200.50' } };

  it('produces a normalized provider-agnostic payload', () => {
    const p = toCourierOrderPayload(address, delivery);
    expect(p.orderNo).toBe('ORD-1');
    expect(p.customerName).toBe('John Doe');
    expect(p.cod).toBe(1200.5);
    expect(p.cityId).toBe(5);
    expect(p.districtId).toBe(2);
    expect(p.waybillId).toBeUndefined();
  });

  it('carries a manual waybill id when provided', () => {
    const p = toCourierOrderPayload(address, delivery, { waybillId: 'WB-99' });
    expect(p.waybillId).toBe('WB-99');
  });
});

describe('isDeliveryStatusAdvance', () => {
  it('advances forward delivery statuses', () => {
    expect(isDeliveryStatusAdvance('DISPATCHED', 'IN_TRANSIT')).toBe(true);
    expect(isDeliveryStatusAdvance('IN_TRANSIT', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(isDeliveryStatusAdvance('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });

  it('does not regress a dispatched parcel on a late submitted poll', () => {
    expect(isDeliveryStatusAdvance('DISPATCHED', 'PENDING_DISPATCH')).toBe(false);
  });

  it('allows failure/return from any non-terminal state', () => {
    expect(isDeliveryStatusAdvance('OUT_FOR_DELIVERY', 'FAILED')).toBe(true);
    expect(isDeliveryStatusAdvance('IN_TRANSIT', 'RETURNED')).toBe(true);
  });

  it('never moves a terminal delivery', () => {
    expect(isDeliveryStatusAdvance('DELIVERED', 'IN_TRANSIT')).toBe(false);
    expect(isDeliveryStatusAdvance('CANCELED', 'DISPATCHED')).toBe(false);
    expect(isDeliveryStatusAdvance('RETURNED', 'DELIVERED')).toBe(false);
  });
});
