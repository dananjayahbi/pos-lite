import { describe, it, expect } from 'vitest';

import { Prisma } from '@/generated/prisma/client';
import { mapPrismaError } from '@/lib/api/map-prisma-error';
import { ApiError } from '@/lib/api/errors';

function known(code: string, message: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
    ...(meta ? { meta } : {}),
  });
}

describe('INF-02 mapPrismaError', () => {
  it('P2002 → 409 CONFLICT with a friendly field-derived message (never the raw dump)', () => {
    const raw =
      'Unique constraint failed on the fields: (`tenantId`,`name`) ' +
      'Invalid `prisma.category.create()` invocation in /home/user/erp/.next/server/chunk123.js:55:11 ' +
      'The provided change conflicts with at least one record already exists.';
    const err = known('P2002', raw, { target: ['tenantId', 'name'] });
    const mapped = mapPrismaError(err);
    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped!.status).toBe(409);
    expect(mapped!.code).toBe('CONFLICT');
    expect(mapped!.message).toContain('tenant id and name');
    // Information-disclosure guard (BUG-21/26/29 family):
    for (const leak of ['prisma', '.next', 'chunk', '/home/', 'Unique constraint']) {
      expect(mapped!.message.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it('P2002 with a string target still humanizes', () => {
    const mapped = mapPrismaError(known('P2002', 'x', { target: 'sku' }));
    expect(mapped!.status).toBe(409);
    expect(mapped!.message).toBe('A record with this sku already exists.');
  });

  it('P2003 → 409 with field-aware message', () => {
    const mapped = mapPrismaError(known('P2003', 'x', { field: 'categoryId' }));
    expect(mapped!.status).toBe(409);
    expect(mapped!.message).toContain('category id');
  });

  it('P2025 → 404 NOT_FOUND', () => {
    const mapped = mapPrismaError(known('P2025', 'No record found'));
    expect(mapped!.status).toBe(404);
    expect(mapped!.code).toBe('NOT_FOUND');
  });

  it('P2023 → 400 VALIDATION-ish bad request', () => {
    const mapped = mapPrismaError(known('P2023', 'Inconsistent column data'));
    expect(mapped!.status).toBe(400);
  });

  it('validation error → 400 without echoing raw input', () => {
    const err = new Prisma.PrismaClientValidationError(
      "Argument `price` is missing in `{ secretPassword: 'hunter2' }`",
      { clientVersion: 'test' },
    );
    const mapped = mapPrismaError(err);
    expect(mapped!.status).toBe(400);
    expect(mapped!.code).toBe('VALIDATION_ERROR');
    expect(mapped!.message).not.toContain('hunter2');
  });

  it('RangeError (numeric/date overflow) → 400', () => {
    const mapped = mapPrismaError(new RangeError('Division by zero'));
    expect(mapped!.status).toBe(400);
  });

  it('unknown error → null (caller decides)', () => {
    expect(mapPrismaError(new Error('something else'))).toBeNull();
    expect(mapPrismaError(null)).toBeNull();
    expect(mapPrismaError('P2002')).toBeNull();
  });
});
