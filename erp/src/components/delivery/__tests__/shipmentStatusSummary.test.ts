import { describe, expect, it } from 'vitest';

import { summarizeShipmentDeliveryStatus } from '@/components/delivery/shipmentStatusSummary';

/**
 * ARGUS #270 — the shipped badge must be the shipment status, with the
 * delivery status shown separately and divergence explained.
 */
describe('summarizeShipmentDeliveryStatus', () => {
  it('marks matching statuses as not diverged', () => {
    const summary = summarizeShipmentDeliveryStatus('DELIVERED', 'DELIVERED');
    expect(summary).toMatchObject({
      shipmentStatus: 'DELIVERED',
      deliveryStatus: 'DELIVERED',
      diverged: false,
      hint: null,
    });
  });

  it('reports a live divergence (shipment SUBMITTED, delivery DELIVERED)', () => {
    const summary = summarizeShipmentDeliveryStatus('SUBMITTED', 'DELIVERED');
    expect(summary.diverged).toBe(true);
    expect(summary.hint).toContain('Submitted');
    expect(summary.hint).toContain('Delivered');
  });

  it('does not claim divergence when the delivery has no shipment yet', () => {
    const summary = summarizeShipmentDeliveryStatus(null, 'PENDING_DISPATCH');
    expect(summary.diverged).toBe(false);
    expect(summary.hint).toBeNull();
  });

  it('is case-sensitive on the raw enum values (no accidental matches)', () => {
    expect(summarizeShipmentDeliveryStatus('delivered', 'DELIVERED').diverged).toBe(true);
  });
});
