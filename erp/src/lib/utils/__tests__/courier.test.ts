import { describe, it, expect } from 'vitest';
import { resolveCityId, resolveDistrictId } from '@/lib/utils/courier';

const cities = [
  { id: 10, text: 'Colombo 02' },
  { id: 11, text: 'Kandy' },
  { id: 12, text: 'Galle' },
];
const districts = [
  { id: 1, text: 'Colombo' },
  { id: 2, text: 'Kandy' },
  { id: 3, text: 'Galle' },
];

describe('resolveCityId', () => {
  it('resolves an exact case-insensitive city', () => {
    expect(resolveCityId(cities, 'kandy')).toBe(11);
    expect(resolveCityId(cities, 'KANDY')).toBe(11);
  });

  it('returns null for empty or missing names', () => {
    expect(resolveCityId(cities, undefined)).toBeNull();
    expect(resolveCityId(cities, '')).toBeNull();
    expect(resolveCityId(cities, '   ')).toBeNull();
  });

  it('returns null when no match exists', () => {
    expect(resolveCityId(cities, 'Nowhere')).toBeNull();
  });
});

describe('resolveDistrictId', () => {
  it('resolves an exact district', () => {
    expect(resolveDistrictId(districts, 'galle')).toBe(3);
  });

  it('returns null for missing input', () => {
    expect(resolveDistrictId(districts, undefined)).toBeNull();
  });
});
