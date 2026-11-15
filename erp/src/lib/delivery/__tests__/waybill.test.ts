import { describe, expect, it } from 'vitest';
import {
  buildWaybillDescription,
  formatWaybillAmount,
  formatWaybillDate,
  waybillBarcodeValue,
} from '@/lib/delivery/waybill';

describe('formatWaybillDate', () => {
  it('prints DD/MM/YYYY like the courier sheet', () => {
    expect(formatWaybillDate('2026-07-20T10:15:00.000Z')).toMatch(/^20\/07\/2026$/);
    expect(formatWaybillDate(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('uses an em dash for missing or invalid values', () => {
    expect(formatWaybillDate(null)).toBe('—');
    expect(formatWaybillDate(undefined)).toBe('—');
    expect(formatWaybillDate('not a date')).toBe('—');
  });
});

describe('formatWaybillAmount', () => {
  it('prints grouped money without a currency prefix', () => {
    expect(formatWaybillAmount(3300)).toBe('3,300.00');
    expect(formatWaybillAmount('3425.5')).toBe('3,425.50');
    expect(formatWaybillAmount(0)).toBe('0.00');
  });

  it('handles junk without producing NaN', () => {
    expect(formatWaybillAmount('abc')).toBe('—');
    expect(formatWaybillAmount(null)).toBe('—');
  });
});

describe('buildWaybillDescription', () => {
  it('combines item count and weight', () => {
    expect(
      buildWaybillDescription({
        itemCount: 2,
        totalWeightKg: 1.5,
        showItemCount: true,
        showWeight: true,
      }),
    ).toBe('2 items · 1.5 kg');
  });

  it('singularizes one item and honours the field toggles', () => {
    expect(
      buildWaybillDescription({
        itemCount: 1,
        totalWeightKg: 1,
        showItemCount: true,
        showWeight: false,
      }),
    ).toBe('1 item');
    expect(
      buildWaybillDescription({
        itemCount: 3,
        totalWeightKg: 2,
        showItemCount: false,
        showWeight: true,
      }),
    ).toBe('2 kg');
  });

  it('falls back to the order reference when all fields are hidden', () => {
    expect(
      buildWaybillDescription({
        itemCount: 2,
        totalWeightKg: 1,
        showItemCount: false,
        showWeight: false,
        fallback: 'ORD-00001',
      }),
    ).toBe('ORD-00001');
  });
});

describe('waybillBarcodeValue', () => {
  it('prefers the courier waybill', () => {
    expect(waybillBarcodeValue({ waybillId: 'BA123456', orderRef: 'ORD-1', showOrderRef: true })).toBe(
      'BA123456',
    );
  });

  it('falls back to the order ref only when enabled, otherwise null', () => {
    expect(waybillBarcodeValue({ waybillId: null, orderRef: 'ORD-1', showOrderRef: true })).toBe(
      'ORD-1',
    );
    expect(waybillBarcodeValue({ waybillId: null, orderRef: 'ORD-1', showOrderRef: false })).toBeNull();
    expect(waybillBarcodeValue({ waybillId: null, orderRef: null, showOrderRef: true })).toBeNull();
  });
});
