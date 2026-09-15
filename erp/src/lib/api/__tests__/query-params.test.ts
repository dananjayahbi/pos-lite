import { describe, it, expect } from 'vitest';

import {
  parseQueryInt,
  parseQueryNumber,
  parseQueryDate,
  parseQueryBool,
  parsePagination,
} from '@/lib/api/query-params';
import { ApiError } from '@/lib/api/errors';

const sp = (q: string) => new URL(`http://x/y?${q}`).searchParams;

describe('XC-01 parseQueryInt', () => {
  it('parses valid integers', () => {
    expect(parseQueryInt(sp('page=3'), 'page')).toBe(3);
    expect(parseQueryInt(sp('page=-2'), 'page')).toBe(-2);
  });

  it('missing → default / undefined', () => {
    expect(parseQueryInt(sp(''), 'page')).toBeUndefined();
    expect(parseQueryInt(sp(''), 'page', { default: 1 })).toBe(1);
    expect(parseQueryInt(sp('page='), 'page', { default: 5 })).toBe(5);
  });

  it("malformed ('abc', '1.5') → 400 naming the param (BUG-28/32/84 family)", () => {
    for (const bad of ['abc', '1.5', '12abc', 'NaN', 'Infinity']) {
      let thrown: unknown;
      try {
        parseQueryInt(sp(`page=${bad}`), 'page');
      } catch (e) {
        thrown = e;
      }
      expect(thrown, `page=${bad} should 400`).toBeInstanceOf(ApiError);
      expect((thrown as ApiError).status).toBe(400);
      expect((thrown as ApiError).message).toContain('page');
    }
  });

  it('whitespace-only value is treated as missing (→ default)', () => {
    expect(parseQueryInt(sp('page=%20'), 'page', { default: 7 })).toBe(7);
  });

  it('out-of-range numeric → clamp (page=0, limit=99999 stay green)', () => {
    expect(parseQueryInt(sp('page=0'), 'page', { min: 1 })).toBe(1);
    expect(parseQueryInt(sp('page=-5'), 'page', { min: 1 })).toBe(1);
    expect(parseQueryInt(sp('limit=99999'), 'limit', { min: 1, max: 200 })).toBe(200);
  });

  it('int4 overflow clamps instead of crashing Prisma skip (BUG-75/82)', () => {
    expect(parseQueryInt(sp('page=99999999999999999999'), 'page', { min: 1, max: 1_000_000 })).toBe(1_000_000);
  });
});

describe('XC-01 parseQueryNumber', () => {
  it('accepts decimals, rejects garbage (spendMin=abc → 400)', () => {
    expect(parseQueryNumber(sp('spendMin=10.5'), 'spendMin')).toBe(10.5);
    expect(() => parseQueryNumber(sp('spendMin=abc'), 'spendMin')).toThrow(ApiError);
    expect(() => parseQueryNumber(sp('spendMin=NaN'), 'spendMin')).toThrow(ApiError);
  });
});

describe('XC-01 parseQueryDate', () => {
  it('accepts ISO dates and datetimes', () => {
    expect(parseQueryDate(sp('from=2026-01-31'), 'from')?.toISOString()).toBe(
      new Date('2026-01-31T00:00:00.000Z').toISOString(),
    );
    expect(parseQueryDate(sp('from=2026-01-31T10:20:30Z'), 'from')).toBeInstanceOf(Date);
  });

  it("garbage / calendar-invalid → 400 (BUG-40/89 family)", () => {
    for (const bad of ['garbage', '2026-13-45', '31/01/2026', '2026']) {
      expect(() => parseQueryDate(sp(`from=${bad}`), 'from')).toThrow(ApiError);
    }
    expect(parseQueryDate(sp(''), 'from')).toBeUndefined();
  });
});

describe('XC-01 parseQueryBool', () => {
  it('true/false/1/0; anything else 400', () => {
    expect(parseQueryBool(sp('x=true'), 'x')).toBe(true);
    expect(parseQueryBool(sp('x=0'), 'x')).toBe(false);
    expect(parseQueryBool(sp(''), 'x', { default: false })).toBe(false);
    expect(() => parseQueryBool(sp('x=maybe'), 'x')).toThrow(ApiError);
  });
});

describe('XC-01 parsePagination', () => {
  it('defaults page=1 limit=20; clamps ranges; 400s garbage', () => {
    expect(parsePagination(sp(''))).toEqual({ page: 1, limit: 20 });
    expect(parsePagination(sp('page=0&limit=99999'))).toEqual({ page: 1, limit: 200 });
    expect(parsePagination(sp('limit=5'))).toEqual({ page: 1, limit: 5 });
    expect(() => parsePagination(sp('page=abc'))).toThrow(ApiError);
  });
});
