import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { selectReferenceMatch } from '@/lib/services/returnReference';

/**
 * ARGUS #98 — a printed sale reference may resolve to exactly one sale; an
 * ambiguous prefix must never silently pick a row.
 */

function caught(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to throw');
}

describe('selectReferenceMatch', () => {
  it('returns the single match', () => {
    expect(selectReferenceMatch('CMWGA0KT', [{ id: 'cmwga0kt0000' }])).toEqual({
      id: 'cmwga0kt0000',
    });
  });

  it('fails clearly when a prefix is ambiguous', () => {
    const error = caught(() =>
      selectReferenceMatch('CMWGA0KT', [
        { id: 'cmwga0kt0001' },
        { id: 'cmwga0kt0002' },
      ]),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('SALE_REFERENCE_AMBIGUOUS');
    expect(error.message).toContain('more than one sale');
  });

  it('reports a missing reference as not found', () => {
    const error = caught(() => selectReferenceMatch('ZZZZZZZZ', []));

    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });
});
