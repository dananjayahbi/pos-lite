/**
 * M01-03 — transactional password-reset token mint.
 *
 * The old forgot-password route ran `deleteMany` and `create` as two separate
 * awaits, so two concurrent requests both observed zero rows and both
 * inserted — one identity holding two simultaneously-live 1-hour tokens
 * (BUG-18). This helper wraps delete+create in a single $transaction so the
 * invariant "at most one live token per identifier" holds by construction.
 *
 * On a unique-violation race (identifier,token) — practically impossible with
 * random 32-byte tokens but covered for defense-in-depth — the mint is
 * retried once; the transaction's delete leg invalidates prior tokens either
 * way.
 */
import { randomBytes } from 'crypto';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — unchanged contract

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

async function mintOnce(identifier: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({ data: { identifier, token, expires } }),
  ]);

  return token;
}

/**
 * Mint exactly one live reset token for `identifier`, killing all prior
 * tokens atomically. Returns the token; throws on real DB failures.
 */
export async function mintPasswordResetToken(identifier: string): Promise<string> {
  try {
    return await mintOnce(identifier);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return mintOnce(identifier);
    }
    throw error;
  }
}
