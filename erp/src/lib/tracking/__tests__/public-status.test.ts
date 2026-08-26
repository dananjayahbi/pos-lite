import { describe, it, expect } from 'vitest';
import {
  mapCustomerDeliveryStatus,
  TIMELINE_STAGES,
} from '@/lib/tracking/public-status';

describe('mapCustomerDeliveryStatus', () => {
  it('maps PLACED to an order-confirmed stage', () => {
    const m = mapCustomerDeliveryStatus('PLACED');
    expect(m.label).toBe('Order confirmed');
    expect(m.stage.key).toBe('order-confirmed');
    expect(m.isTerminal).toBe(false);
    expect(m.isFailure).toBe(false);
  });

  it('maps OUT_FOR_DELIVERY to a friendly label at stage 4', () => {
    const m = mapCustomerDeliveryStatus('OUT_FOR_DELIVERY');
    expect(m.label).toBe('Out for delivery');
    expect(m.stage.stage).toBe(4);
  });

  it('marks DELIVERED as terminal', () => {
    const m = mapCustomerDeliveryStatus('DELIVERED');
    expect(m.label).toBe('Delivered');
    expect(m.isTerminal).toBe(true);
    expect(m.isFailure).toBe(false);
  });

  it('marks FAILED as a failure state', () => {
    const m = mapCustomerDeliveryStatus('FAILED');
    expect(m.isFailure).toBe(true);
    expect(m.label).toBe('Delivery failed');
  });

  it('falls back to a neutral state for unknown values', () => {
    const m = mapCustomerDeliveryStatus('SOME_WEIRD_VALUE');
    expect(m.label).toBe('Order in progress');
    expect(m.isFailure).toBe(false);
    expect(m.isTerminal).toBe(false);
  });

  it('treats null/undefined as in-progress', () => {
    expect(mapCustomerDeliveryStatus(null).label).toBe('Order in progress');
    expect(mapCustomerDeliveryStatus(undefined).label).toBe('Order in progress');
  });
});

describe('TIMELINE_STAGES', () => {
  it('orders the milestone keys from confirmed to delivered', () => {
    expect(TIMELINE_STAGES).toEqual([
      'order-confirmed',
      'preparing',
      'shipped',
      'in-transit',
      'out-for-delivery',
      'delivered',
    ]);
  });
});
