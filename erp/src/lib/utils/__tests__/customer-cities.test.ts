import { describe, expect, it } from 'vitest';
import { buildCustomerCityOptions } from '@/lib/utils/customer-cities';

const FALLBACK = ['Colombo', 'Kandy', 'Galle'];

describe('buildCustomerCityOptions', () => {
  it('uses the Trans Express cache when present and dedupes case-insensitively', () => {
    const result = buildCustomerCityOptions(
      [
        { id: 1, text: 'Colombo' },
        { id: 2, text: 'Kandy' },
        { id: 3, text: 'colombo' },
      ],
      FALLBACK,
    );

    expect(result.source).toBe('TRANSEXPRESS');
    expect(result.cities.map((c) => c.label)).toEqual(['Colombo', 'Kandy']);
    expect(result.cities[0]).toMatchObject({ value: 'Colombo', id: 1 });
  });

  it('falls back to the curated list when the cache is empty', () => {
    const result = buildCustomerCityOptions([], FALLBACK);
    expect(result.source).toBe('FALLBACK');
    expect(result.cities.map((c) => c.value)).toEqual(['Colombo', 'Galle', 'Kandy']);
  });

  it('keeps an existing city that is missing from the master list', () => {
    const result = buildCustomerCityOptions(
      [{ id: 1, text: 'Colombo' }],
      FALLBACK,
      '  Anuradhapura  ',
    );

    expect(result.cities.map((c) => c.value)).toContain('Anuradhapura');
  });

  it('sorts options alphabetically for a predictable selector', () => {
    const result = buildCustomerCityOptions([], FALLBACK);
    const labels = result.cities.map((c) => c.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});
