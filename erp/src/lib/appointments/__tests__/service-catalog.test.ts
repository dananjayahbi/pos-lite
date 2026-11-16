import { describe, expect, it } from 'vitest';

import {
  filterAppointmentServices,
  summarizeAppointmentServices,
  toServicePrice,
  type AppointmentServiceRecord,
} from '../service-catalog';

function service(overrides: Partial<AppointmentServiceRecord> = {}): AppointmentServiceRecord {
  return {
    id: 'svc-1',
    name: 'Consultation',
    description: 'Initial consultation',
    durationMins: 45,
    price: '2500',
    color: '#A48374',
    isActive: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe('toServicePrice', () => {
  it('parses Prisma Decimal strings', () => {
    expect(toServicePrice('2500.50')).toBe(2500.5);
  });

  it('passes numbers through', () => {
    expect(toServicePrice(750)).toBe(750);
  });

  it('reads Decimal-like objects', () => {
    expect(toServicePrice({ toString: () => '120.25' })).toBe(120.25);
  });

  it('falls back to 0 for null, undefined and unparseable values', () => {
    expect(toServicePrice(null)).toBe(0);
    expect(toServicePrice(undefined)).toBe(0);
    expect(toServicePrice('not-a-number')).toBe(0);
  });
});

describe('filterAppointmentServices', () => {
  const catalogue = [
    service({ id: 'a', name: 'Consultation', description: 'Initial consultation', isActive: true }),
    service({ id: 'b', name: 'Massage Therapy', description: 'Deep tissue', isActive: false }),
    service({ id: 'c', name: 'Follow-up', description: null, isActive: true }),
  ];

  it('returns every service for an empty filter', () => {
    expect(filterAppointmentServices(catalogue).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(filterAppointmentServices(catalogue, { search: '   ' }).map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('matches the name case-insensitively', () => {
    expect(filterAppointmentServices(catalogue, { search: 'massage' }).map((s) => s.id)).toEqual([
      'b',
    ]);
  });

  it('matches the description too and tolerates a null description', () => {
    expect(filterAppointmentServices(catalogue, { search: 'tissue' }).map((s) => s.id)).toEqual([
      'b',
    ]);
    expect(filterAppointmentServices(catalogue, { search: 'follow' }).map((s) => s.id)).toEqual([
      'c',
    ]);
  });

  it('filters by active/inactive status', () => {
    expect(
      filterAppointmentServices(catalogue, { status: 'active' }).map((s) => s.id),
    ).toEqual(['a', 'c']);
    expect(
      filterAppointmentServices(catalogue, { status: 'inactive' }).map((s) => s.id),
    ).toEqual(['b']);
    expect(filterAppointmentServices(catalogue, { status: 'all' })).toHaveLength(3);
  });

  it('combines search and status', () => {
    expect(
      filterAppointmentServices(catalogue, { search: 'consult', status: 'inactive' }),
    ).toEqual([]);
  });

  it('returns no matches for an unknown term', () => {
    expect(filterAppointmentServices(catalogue, { search: 'nope' })).toEqual([]);
  });
});

describe('summarizeAppointmentServices', () => {
  it('returns zeroed stats for an empty catalogue', () => {
    expect(summarizeAppointmentServices([])).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      averageDurationMins: 0,
      lowestPrice: null,
      highestPrice: null,
    });
  });

  it('counts active services and rounds the average duration', () => {
    const summary = summarizeAppointmentServices([
      service({ id: 'a', durationMins: 30, price: '1000', isActive: true }),
      service({ id: 'b', durationMins: 45, price: 2500, isActive: true }),
      service({ id: 'c', durationMins: 50, price: '500', isActive: false }),
    ]);

    expect(summary).toEqual({
      total: 3,
      active: 2,
      inactive: 1,
      averageDurationMins: 42, // 125 / 3 = 41.67 → 42
      lowestPrice: 500,
      highestPrice: 2500,
    });
  });

  it('reports the single price as both low and high when only one service exists', () => {
    const summary = summarizeAppointmentServices([service({ price: '750.00' })]);
    expect(summary.lowestPrice).toBe(750);
    expect(summary.highestPrice).toBe(750);
  });
});
