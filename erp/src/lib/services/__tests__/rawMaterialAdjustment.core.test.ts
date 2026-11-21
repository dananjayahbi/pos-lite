import { describe, expect, it } from 'vitest';

import {
  isRawMaterialAdjustmentReason,
  mapRawMaterialAdjustmentAudit,
  RAW_MATERIAL_ADJUSTMENT_REASON_LABELS,
  RAW_MATERIAL_ADJUSTMENT_REASONS,
} from '@/lib/services/rawMaterialAdjustment.core';

/** ARGUS #246: a fixed server-enforced reason vocabulary + audit history. */
describe('raw material adjustment reasons', () => {
  it('accepts exactly the five documented reasons', () => {
    expect([...RAW_MATERIAL_ADJUSTMENT_REASONS]).toEqual([
      'purchase',
      'production',
      'wastage',
      'correction',
      'return',
    ]);
    for (const reason of RAW_MATERIAL_ADJUSTMENT_REASONS) {
      expect(isRawMaterialAdjustmentReason(reason)).toBe(true);
      expect(RAW_MATERIAL_ADJUSTMENT_REASON_LABELS[reason]).toBeTruthy();
    }
  });

  it('rejects free text, empty and non-string values', () => {
    expect(isRawMaterialAdjustmentReason('write-off')).toBe(false);
    expect(isRawMaterialAdjustmentReason('')).toBe(false);
    expect(isRawMaterialAdjustmentReason(undefined)).toBe(false);
    expect(isRawMaterialAdjustmentReason(3)).toBe(false);
  });
});

describe('mapRawMaterialAdjustmentAudit', () => {
  it('maps an audit row to a history entry', () => {
    expect(
      mapRawMaterialAdjustmentAudit({
        id: 'log_1',
        createdAt: new Date('2026-11-22T10:00:00.000Z'),
        actorName: 'Nimal',
        after: {
          quantityDelta: '5.0000',
          quantityBefore: '10.0000',
          quantityAfter: '15.0000',
          reason: 'purchase',
        },
      }),
    ).toEqual({
      id: 'log_1',
      createdAt: '2026-11-22T10:00:00.000Z',
      actorName: 'Nimal',
      reason: 'purchase',
      reasonText: 'purchase',
      quantityDelta: '5.0000',
      quantityBefore: '10.0000',
      quantityAfter: '15.0000',
    });
  });

  it('keeps a legacy free-text reason without pretending it is a known enum', () => {
    const row = mapRawMaterialAdjustmentAudit({
      id: 'log_2',
      createdAt: '2026-11-22T09:00:00.000Z',
      after: { quantityDelta: '-2', reason: 'write-off' },
    });
    expect(row.reason).toBeNull();
    expect(row.reasonText).toBe('write-off');
  });

  it('tolerates missing or malformed audit JSON', () => {
    expect(
      mapRawMaterialAdjustmentAudit({ id: 'log_3', createdAt: '2026-11-22T09:00:00.000Z', after: null }),
    ).toMatchObject({
      actorName: 'System',
      reason: null,
      reasonText: null,
      quantityDelta: null,
      quantityBefore: null,
      quantityAfter: null,
    });
  });
});
