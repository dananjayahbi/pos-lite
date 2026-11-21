import { describe, expect, it } from 'vitest';

import {
  bulkStatusRejection,
  bulkStatusTargetsForOrder,
  commonBulkStatusTargets,
} from '@/lib/services/dispatchStatus.core';

/**
 * ARGUS #263 — bulk status targets must never bypass dispatch or recovery.
 */
describe('bulkStatusTargetsForOrder', () => {
  it('offers only pre-dispatch moves while the parcel is not dispatched', () => {
    expect(bulkStatusTargetsForOrder('PLACED', false)).toEqual([
      'PENDING_DISPATCH',
      'HOLD',
      'CANCELED',
    ]);
    expect(bulkStatusTargetsForOrder('PENDING_DISPATCH', false)).toEqual([
      'HOLD',
      'CANCELED',
    ]);
    expect(bulkStatusTargetsForOrder('HOLD', false)).toEqual([
      'PENDING_DISPATCH',
      'CANCELED',
    ]);
  });

  it('never offers carrier states without a shipment', () => {
    const targets = bulkStatusTargetsForOrder('PENDING_DISPATCH', false);
    expect(targets).not.toContain('DELIVERED');
    expect(targets).not.toContain('DISPATCHED');
    expect(targets).not.toContain('IN_TRANSIT');
  });

  it('offers forward carrier moves once dispatched', () => {
    expect(bulkStatusTargetsForOrder('DISPATCHED', true)).toEqual([
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
    expect(bulkStatusTargetsForOrder('IN_TRANSIT', true)).toEqual([
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
    expect(bulkStatusTargetsForOrder('OUT_FOR_DELIVERY', true)).toEqual(['DELIVERED']);
  });

  it('never offers FAILED/RETURNED or moves out of final states', () => {
    expect(bulkStatusTargetsForOrder('DISPATCHED', true)).not.toContain('FAILED');
    expect(bulkStatusTargetsForOrder('DISPATCHED', true)).not.toContain('RETURNED');
    for (const status of ['DELIVERED', 'CANCELED', 'RETURNED', 'FAILED'] as const) {
      expect(bulkStatusTargetsForOrder(status, true)).toEqual([]);
    }
  });
});

describe('bulkStatusRejection', () => {
  it('rejects DELIVERED before dispatch', () => {
    expect(bulkStatusRejection('PLACED', 'DELIVERED', false)).toBe('Dispatch the delivery first');
    expect(bulkStatusRejection('PENDING_DISPATCH', 'DELIVERED', false)).toBe(
      'Dispatch the delivery first',
    );
    expect(bulkStatusRejection('DISPATCHED', 'DELIVERED', false)).toBe(
      'Dispatch the delivery first',
    );
  });

  it('allows DELIVERED once the parcel has a shipment', () => {
    expect(bulkStatusRejection('DISPATCHED', 'DELIVERED', true)).toBeNull();
    expect(bulkStatusRejection('IN_TRANSIT', 'DELIVERED', true)).toBeNull();
    expect(bulkStatusRejection('OUT_FOR_DELIVERY', 'DELIVERED', true)).toBeNull();
  });

  it('routes FAILED/RETURNED to the recovery desk', () => {
    expect(bulkStatusRejection('DISPATCHED', 'FAILED', true)).toContain('Recovery');
    expect(bulkStatusRejection('DISPATCHED', 'RETURNED', true)).toContain('Recovery');
  });

  it('allows cancel only before dispatch', () => {
    expect(bulkStatusRejection('PENDING_DISPATCH', 'CANCELED', false)).toBeNull();
    expect(bulkStatusRejection('DISPATCHED', 'CANCELED', true)).toContain('Recovery');
  });

  it('rejects no-ops and writes to final states', () => {
    expect(bulkStatusRejection('PENDING_DISPATCH', 'PENDING_DISPATCH', false)).toBe(
      'Already in this status',
    );
    expect(bulkStatusRejection('DELIVERED', 'IN_TRANSIT', true)).toContain('final state');
  });
});

describe('commonBulkStatusTargets', () => {
  it('intersects the legal moves of a mixed selection', () => {
    expect(
      commonBulkStatusTargets([
        { status: 'PLACED', hasShipment: false },
        { status: 'PENDING_DISPATCH', hasShipment: false },
      ]),
    ).toEqual(['HOLD', 'CANCELED']);
  });

  it('returns every shared carrier move for a homogeneous dispatched selection', () => {
    expect(
      commonBulkStatusTargets([
        { status: 'DISPATCHED', hasShipment: true },
        { status: 'DISPATCHED', hasShipment: true },
      ]),
    ).toEqual(['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']);
  });

  it('returns nothing when pre-dispatch and dispatched rows are mixed', () => {
    expect(
      commonBulkStatusTargets([
        { status: 'PENDING_DISPATCH', hasShipment: false },
        { status: 'DISPATCHED', hasShipment: true },
      ]),
    ).toEqual([]);
  });
});
