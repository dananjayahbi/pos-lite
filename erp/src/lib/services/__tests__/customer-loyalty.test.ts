import { describe, it, expect, vi } from 'vitest';
import {
  getLoyaltyTier,
  LOYALTY_TIER_META,
  REPEAT_ORDER_THRESHOLD,
  LOYAL_ORDER_THRESHOLD,
} from '@/lib/services/customer-loyalty';
import { formatRelativeDate } from '@/lib/format';

describe('getLoyaltyTier', () => {
  it('classifies 0–1 orders as first-time', () => {
    expect(getLoyaltyTier(0)).toBe('FIRST_TIME');
    expect(getLoyaltyTier(1)).toBe('FIRST_TIME');
  });

  it('classifies ≥2 orders as repeat', () => {
    expect(getLoyaltyTier(REPEAT_ORDER_THRESHOLD)).toBe('REPEAT');
    expect(getLoyaltyTier(3)).toBe('REPEAT');
  });

  it('upgrades to loyal at the higher threshold', () => {
    expect(getLoyaltyTier(LOYAL_ORDER_THRESHOLD)).toBe('LOYAL');
    expect(getLoyaltyTier(10)).toBe('LOYAL');
  });

  it('provides meta for every tier', () => {
    const tiers = ['FIRST_TIME', 'REPEAT', 'LOYAL'] as const;
    for (const tier of tiers) {
      expect(LOYALTY_TIER_META[tier].label.length).toBeGreaterThan(0);
      expect(LOYALTY_TIER_META[tier].hint.length).toBeGreaterThan(0);
    }
  });
});

describe('formatRelativeDate', () => {
  it('returns null for nullish input', () => {
    expect(formatRelativeDate(null)).toBeNull();
    expect(formatRelativeDate(undefined)).toBeNull();
  });

  it('formats recent dates relative to now', () => {
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'));
    expect(formatRelativeDate(new Date('2026-08-07T11:00:00Z'))).toBe('1 hour ago');
    expect(formatRelativeDate(new Date('2026-08-05T12:00:00Z'))).toBe('2 days ago');
    vi.useRealTimers();
  });

  it('returns "just now" for sub-minute deltas', () => {
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'));
    expect(formatRelativeDate(new Date('2026-08-07T11:59:40Z'))).toBe('just now');
    vi.useRealTimers();
  });
});
