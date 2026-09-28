import { describe, it, expect } from 'vitest';

import { mapServiceError } from '@/lib/api/map-service-error';
import { ApiError } from '@/lib/api/errors';

describe('INF-02 mapServiceError', () => {
  it.each([
    ['NOT_FOUND', 404],
    ['FORBIDDEN', 403],
    ['BELOW_ZERO', 400],
    ['DELTA_ZERO', 400],
    ['BOM_EXISTS', 409],
    ['ALREADY_DISPUTED', 409],
    ['SERVICE_NAME_EXISTS', 409],
    ['TRADED_NOT_MANUFACTURED', 400],
    ['INSUFFICIENT_STOCK:3.5', 409],
    ['CONFLICT: A shift is already open for this cashier', 409],
    ['LEDGER_ENTRY_NOT_FOUND', 404],
    ['DISPUTE_NOT_FOUND', 404],
    ['APPOINTMENT_NOT_FOUND', 404],
  ])('sentinel %s → %i', (message, status) => {
    const mapped = mapServiceError(new Error(message));
    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped!.status).toBe(status);
  });

  it('prose service messages keep their historical status/code', () => {
    expect(mapServiceError(new Error('Category not found'))!.status).toBe(404);
    expect(mapServiceError(new Error('Category not found'))!.code).toBe('NOT_FOUND');
    const inUse = mapServiceError(new Error('Cannot delete category while products are assigned to it'));
    expect(inUse!.status).toBe(409);
    expect(inUse!.code).toBe('CATEGORY_IN_USE');
    const brand = mapServiceError(new Error('Cannot delete brand while products are assigned to it'));
    expect(brand!.code).toBe('BRAND_IN_USE');
    expect(mapServiceError(new Error('A customer with this phone number already exists'))!.status).toBe(409);
    expect(mapServiceError(new Error('SKU already exists: ABC'))!.status).toBe(409);
  });

  it('never matches unexpected prose (returns null)', () => {
    expect(mapServiceError(new Error('Connection to the database timed out'))).toBeNull();
    expect(mapServiceError(new Error(''))).toBeNull();
    expect(mapServiceError(null)).toBeNull();
    expect(mapServiceError(undefined)).toBeNull();
  });

  it('BUG-66 class: dispute sentinels no longer fall through to 500', () => {
    for (const s of ['LEDGER_ENTRY_NOT_FOUND', 'DISPUTE_NOT_FOUND', 'ALREADY_DISPUTED']) {
      const mapped = mapServiceError(new Error(s));
      expect(mapped).not.toBeNull();
      expect(mapped!.status).toBeLessThan(500);
    }
  });
});
