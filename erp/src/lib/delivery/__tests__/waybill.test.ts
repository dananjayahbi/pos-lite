import { describe, expect, it } from 'vitest';
import {
  buildWaybillAddress,
  buildWaybillDescription,
  dedupeLocality,
  formatWaybillAmount,
  formatWaybillDate,
  formatWaybillWeight,
  isDraftWaybill,
  waybillBarcodeValue,
} from '@/lib/delivery/waybill';

describe('buildWaybillAddress (ARGUS #302)', () => {
  it('prints one locality when city and district match', () => {
    expect(
      buildWaybillAddress({
        addressLine1: '123 Main Street',
        addressLine2: 'Colombo 3',
        cityName: 'Colombo',
        districtName: 'Colombo',
        postalCode: '00100',
      }),
    ).toBe('123 Main Street, Colombo 3, Colombo, 00100');

    expect(
      buildWaybillAddress({
        addressLine1: 'Main Road',
        cityName: 'Deiyandara',
        districtName: 'Deiyandara',
        postalCode: '81320',
      }),
    ).toBe('Main Road, Deiyandara, 81320');
  });

  it('keeps both names when the city and district differ', () => {
    expect(dedupeLocality('Moratuwa', 'Colombo')).toBe('Moratuwa, Colombo');
    expect(dedupeLocality('Deiyandara', 'deiyandara')).toBe('Deiyandara');
  });

  it('collapses an address line that already repeats the city', () => {
    expect(
      buildWaybillAddress({
        addressLine1: '45 Temple Road',
        addressLine2: 'Kandy',
        cityName: 'Kandy',
        districtName: 'Kandy',
      }),
    ).toBe('45 Temple Road, Kandy');
  });

  it('omits missing parts without leaving stray commas', () => {
    expect(buildWaybillAddress({ addressLine1: '  Main Street ' })).toBe('Main Street');
    expect(buildWaybillAddress({ cityName: null, districtName: 'Galle' })).toBe('Galle');
  });
});

describe('formatWaybillDate', () => {
  it('prints DD/MM/YYYY like the courier sheet', () => {
    expect(formatWaybillDate('2026-07-20T10:15:00.000Z')).toMatch(/^20\/07\/2026$/);
    expect(formatWaybillDate(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('uses an em dash for missing or invalid values', () => {
    expect(formatWaybillDate(null)).toBe('-');
    expect(formatWaybillDate(undefined)).toBe('-');
    expect(formatWaybillDate('not a date')).toBe('-');
  });
});

describe('formatWaybillAmount', () => {
  it('prints grouped money without a currency prefix', () => {
    expect(formatWaybillAmount(3300)).toBe('3,300.00');
    expect(formatWaybillAmount('3425.5')).toBe('3,425.50');
    expect(formatWaybillAmount(0)).toBe('0.00');
  });

  it('handles junk without producing NaN', () => {
    expect(formatWaybillAmount('abc')).toBe('-');
    expect(formatWaybillAmount(null)).toBe('-');
  });
});

describe('buildWaybillDescription', () => {
  it('combines item count and a two-decimal weight', () => {
    expect(
      buildWaybillDescription({
        itemCount: 2,
        totalWeightKg: 1.5,
        showItemCount: true,
        showWeight: true,
      }),
    ).toBe('2 items · 1.50 kg');
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
    ).toBe('2.00 kg');
  });

  it('states an explicit missing weight instead of silently omitting it (ARGUS #303)', () => {
    for (const totalWeightKg of [null, undefined, '', 'not-a-number']) {
      expect(
        buildWaybillDescription({
          itemCount: 1,
          totalWeightKg,
          showItemCount: true,
          showWeight: true,
        }),
      ).toBe('1 item · weight n/a');
    }
    expect(formatWaybillWeight(1)).toBe('1.00');
    expect(formatWaybillWeight('1.567')).toBe('1.57');
    expect(formatWaybillWeight(null)).toBeNull();
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
  it('uses the courier waybill when present', () => {
    expect(waybillBarcodeValue({ waybillId: 'BA123456', orderRef: 'ORD-1', showOrderRef: true })).toBe(
      'BA123456',
    );
  });

  it('never substitutes the internal order ref as a courier barcode', () => {
    expect(waybillBarcodeValue({ waybillId: null, orderRef: 'ORD-1', showOrderRef: true })).toBeNull();
    expect(waybillBarcodeValue({ waybillId: null, orderRef: null, showOrderRef: true })).toBeNull();
  });
});

describe('isDraftWaybill', () => {
  it('marks a pre-dispatch label as a draft', () => {
    expect(isDraftWaybill(null)).toBe(true);
    expect(isDraftWaybill(undefined)).toBe(true);
    expect(isDraftWaybill('BA123456')).toBe(false);
  });
});
