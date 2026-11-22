import { describe, expect, it } from 'vitest';

import {
  isInvalidCustomerBirthday,
  normalizeImportTags,
  parseCustomerBirthday,
  reconcileImportCounts,
} from '@/lib/services/customerImport.core';

/** ARGUS #318: birthday, tag normalization and honest import counts. */
describe('parseCustomerBirthday', () => {
  it('accepts a real YYYY-MM-DD date at UTC midnight', () => {
    const date = parseCustomerBirthday('1990-09-17');
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe('1990-09-17T00:00:00.000Z');
  });

  it('returns null for empty, malformed and impossible dates', () => {
    for (const value of ['', '   ', 'not-a-date', '17/09/1990', '2026-02-31', '2026-13-01']) {
      expect(parseCustomerBirthday(value), value).toBeNull();
    }
  });

  it('rejects a future birthday', () => {
    const nextYear = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    const value = nextYear.toISOString().slice(0, 10);
    expect(parseCustomerBirthday(value)).toBeNull();
  });

  it('distinguishes an empty cell from an invalid one', () => {
    expect(isInvalidCustomerBirthday('')).toBe(false);
    expect(isInvalidCustomerBirthday(undefined)).toBe(false);
    expect(isInvalidCustomerBirthday('2026-02-31')).toBe(true);
  });
});

describe('normalizeImportTags', () => {
  it('upper-cases, trims and de-duplicates tags', () => {
    expect(normalizeImportTags(' vip, Wholesale ,vip, ,regular ')).toEqual([
      'VIP',
      'WHOLESALE',
      'REGULAR',
    ]);
  });

  it('returns an empty list for a blank cell', () => {
    expect(normalizeImportTags('')).toEqual([]);
    expect(normalizeImportTags(undefined)).toEqual([]);
  });
});

describe('reconcileImportCounts', () => {
  it('reports the actual inserted count and the shortfall as skipped', () => {
    expect(reconcileImportCounts(3, 2)).toEqual({
      imported: 2,
      skipped: 1,
      notes: ['1 row skipped by the database (duplicate phone)'],
    });
  });

  it('reports everything as imported when the counts agree', () => {
    expect(reconcileImportCounts(4, 4)).toEqual({ imported: 4, skipped: 0, notes: [] });
    expect(reconcileImportCounts(0, 0)).toEqual({ imported: 0, skipped: 0, notes: [] });
  });

  it('never reports more imported than were validated', () => {
    expect(reconcileImportCounts(1, 5)).toMatchObject({ imported: 1, skipped: 0 });
  });
});
