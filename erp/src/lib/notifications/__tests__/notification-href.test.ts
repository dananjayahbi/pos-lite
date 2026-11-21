import { describe, expect, it } from 'vitest';

import { getNotificationHref } from '@/lib/notifications/notification-href';

/**
 * ARGUS #54 — every notification row must offer the same link as the bell
 * menu; only types with a real destination get an Open button.
 */
describe('getNotificationHref', () => {
  const id = 'cm_sale_123';

  it('links sales to the sale detail page (voided sales keep the link)', () => {
    expect(getNotificationHref({ type: 'SALE_COMPLETED', relatedEntityId: id })).toBe(
      `/sales/${id}`,
    );
    // A voided alert is still a SALE_COMPLETED row; the UI adds the label.
    expect(getNotificationHref({ type: 'SALE_COMPLETED', relatedEntityId: id })).not.toBeNull();
  });

  it('falls back to the sales list when the sale id is missing', () => {
    expect(getNotificationHref({ type: 'SALE_COMPLETED', relatedEntityId: null })).toBe('/sales');
  });

  it('links returns to the returns ledger', () => {
    expect(getNotificationHref({ type: 'RETURN_PROCESSED', relatedEntityId: 'ret_1' })).toBe(
      '/returns',
    );
  });

  it('links shifts to the shift detail, or the shift list without an id', () => {
    expect(getNotificationHref({ type: 'SHIFT_CLOSED', relatedEntityId: 'shift_1' })).toBe(
      '/staff/shifts/shift_1',
    );
    expect(getNotificationHref({ type: 'SHIFT_CLOSED', relatedEntityId: null })).toBe(
      '/staff/shifts',
    );
  });

  it('links every stock-take status to the review screen', () => {
    for (const type of ['STOCK_TAKE_SUBMITTED', 'STOCK_TAKE_APPROVED', 'STOCK_TAKE_REJECTED']) {
      expect(getNotificationHref({ type, relatedEntityId: 'st_1' })).toBe(
        '/stock-control/stock-takes/st_1/review',
      );
    }
    expect(getNotificationHref({ type: 'STOCK_TAKE_SUBMITTED' })).toBe(
      '/stock-control/stock-takes',
    );
  });

  it('links the catalogue alerts', () => {
    expect(getNotificationHref({ type: 'LOW_STOCK_ALERT' })).toBe('/stock-control/low-stock');
    expect(getNotificationHref({ type: 'PETTY_CASH_LOW' })).toBe('/petty-cash');
    expect(getNotificationHref({ type: 'RAW_MATERIAL_LOW_STOCK' })).toBe(
      '/factory/raw-materials?stockStatus=LOW',
    );
    expect(getNotificationHref({ type: 'RAW_MATERIAL_CRITICAL' })).toBe(
      '/factory/raw-materials?stockStatus=OUT',
    );
    expect(getNotificationHref({ type: 'BATCH_EXPIRED' })).toBe('/inventory/batches');
    expect(getNotificationHref({ type: 'BATCH_EXPIRY_SOON' })).toBe('/inventory/batches');
    expect(getNotificationHref({ type: 'PACKAGING_LOW_STOCK' })).toBe('/delivery/packaging');
  });

  it('links delivery and reconciliation alerts', () => {
    for (const type of [
      'DELIVERY_STATUS_UPDATED',
      'DELIVERY_FAILED',
      'DELIVERY_DISPATCHED',
      'DELIVERY_DELIVERED',
      'DELIVERY_HELD_EXPIRING',
    ]) {
      expect(getNotificationHref({ type, relatedEntityId: 'del_1' })).toBe('/delivery/del_1');
      expect(getNotificationHref({ type, relatedEntityId: null })).toBe('/delivery');
    }
    expect(getNotificationHref({ type: 'COD_PENDING_ALERT' })).toBe('/delivery/reconciliation');
    expect(getNotificationHref({ type: 'RECONCILIATION_DISCREPANCY' })).toBe(
      '/delivery/reconciliation',
    );
  });

  it('returns null for SYSTEM_ALERT and unknown types (no dead Open button)', () => {
    expect(getNotificationHref({ type: 'SYSTEM_ALERT', relatedEntityId: 'x' })).toBeNull();
    expect(getNotificationHref({ type: 'FUTURE_TYPE', relatedEntityId: 'x' })).toBeNull();
  });

  it('never builds an absolute or protocol URL from an id', () => {
    const href = getNotificationHref({
      type: 'SALE_COMPLETED',
      relatedEntityId: 'javascript:alert(1)',
    });
    expect(href?.startsWith('/sales/')).toBe(true);
    expect(href).not.toContain('://');
    expect(href).not.toContain('javascript:');
  });

  it('treats blank ids as missing', () => {
    expect(getNotificationHref({ type: 'SALE_COMPLETED', relatedEntityId: '   ' })).toBe('/sales');
    expect(getNotificationHref({ type: 'SHIFT_CLOSED', relatedEntityId: '' })).toBe(
      '/staff/shifts',
    );
  });
});
