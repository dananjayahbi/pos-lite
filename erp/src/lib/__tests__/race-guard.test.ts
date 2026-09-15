/**
 * XC-06 — shared race-guard primitives. withUniqueGuard is the insert-and-map
 * pattern every later race doc must reuse (M03-06 is the reference instance).
 */
import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { ApiError } from '@/lib/api/errors';
import { isUniqueViolation, withUniqueGuard } from '@/lib/api/race-guard';

function p2002(target = 'email'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.8.0',
    meta: { target },
  });
}

describe('isUniqueViolation', () => {
  it('recognizes P2002 only', () => {
    expect(isUniqueViolation(p2002())).toBe(true);
    expect(
      isUniqueViolation(
        new Prisma.PrismaClientKnownRequestError('nope', {
          code: 'P2025',
          clientVersion: '7.8.0',
        }),
      ),
    ).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
});

describe('withUniqueGuard', () => {
  it('passes through a successful write', async () => {
    await expect(withUniqueGuard(async () => 'created')).resolves.toBe('created');
  });

  it('maps a P2002 race loser to a typed 409 CONFLICT (never a raw 500)', async () => {
    const err = await withUniqueGuard(async () => {
      throw p2002();
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).code).toBe('CONFLICT');
  });

  it('honors a custom conflict message (friendly fast-path copy)', async () => {
    const err = await withUniqueGuard(
      async () => {
        throw p2002();
      },
      'A user with this email already exists',
    ).catch((e) => e);
    expect((err as ApiError).message).toBe('A user with this email already exists');
  });

  it('rethrows non-P2002 errors untouched', async () => {
    const boom = new Error('network');
    await expect(
      withUniqueGuard(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
