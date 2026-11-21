/**
 * M03-05 (BUG-7) / ARGUS #342 — commissionRate validator: shape (<=2 dp) AND
 * the single 0-100 percent contract shared with the form and the commission
 * engine. The old shape-only regex let 1000.00 and 20-digit strings reach
 * Prisma -> numeric overflow -> HTTP 500; the later 999.99 column ceiling let
 * a rate the engine would never pay.
 */
import { describe, expect, it } from 'vitest';
import { CreateStaffSchema } from '@/lib/validators/staff.validators';

function parseRate(rate: string): boolean {
  return CreateStaffSchema.safeParse({
    email: 'qa@example.com',
    role: 'CASHIER',
    commissionRate: rate,
  }).success;
}

describe('commissionRate validation (M03-05 / ARGUS #342)', () => {
  it('accepts the documented valid domain (tests 2.1/2.3 shapes)', () => {
    for (const ok of ['5.00', '12.50', '0.01', '99.99', '7', '0', '100', '100.00']) {
      expect(parseRate(ok), `${ok} must be accepted`).toBe(true);
    }
  });

  it('rejects anything above 100 percent with a 400-level validation', () => {
    for (const bad of ['100.01', '999.99', '1000.00', '99999', '99999999999999999999', '999.991']) {
      expect(parseRate(bad), `${bad} must be rejected`).toBe(false);
    }
  });

  it('rejects malformed shapes', () => {
    for (const bad of ['-5', 'abc', '1e30', '5.', '.5', '']) {
      expect(parseRate(bad), `${bad} must be rejected`).toBe(false);
    }
  });

  it('the rejection message names the 0-100 bound', () => {
    const parsed = CreateStaffSchema.safeParse({
      email: 'qa@example.com',
      role: 'CASHIER',
      commissionRate: '100.01',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(' ');
      expect(messages).toMatch(/0 and 100/);
    }
  });
});
