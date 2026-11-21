import { describe, expect, it } from 'vitest';

import { CreateCustomerPricingRuleSchema } from '@/lib/validators/customer-pricing.validators';

/**
 * ARGUS #327: a customer-pricing window uses the same date-only conversion as
 * promotions, so a same-day rule is valid instead of being rejected as empty.
 */
describe('CreateCustomerPricingRuleSchema windows', () => {
  const base = { customerTag: 'WHOLESALE', price: 100 };

  it('accepts a same-day date-only window', () => {
    const parsed = CreateCustomerPricingRuleSchema.safeParse({
      ...base,
      startsAt: '2026-10-29',
      endsAt: '2026-10-29',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    const parsed = CreateCustomerPricingRuleSchema.safeParse({
      ...base,
      startsAt: '2026-10-29',
      endsAt: '2026-10-28',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['endsAt']);
    }
  });

  it('rejects a malformed bound', () => {
    const parsed = CreateCustomerPricingRuleSchema.safeParse({
      ...base,
      startsAt: 'not-a-date',
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(['startsAt']);
    }
  });

  it('treats blank bounds as open-ended', () => {
    const parsed = CreateCustomerPricingRuleSchema.safeParse({
      ...base,
      startsAt: '',
      endsAt: '',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.startsAt).toBeUndefined();
      expect(parsed.data.endsAt).toBeUndefined();
    }
  });
});
