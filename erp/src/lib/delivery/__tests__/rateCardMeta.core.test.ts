import { describe, expect, it } from 'vitest';

import { EMPTY_RATE_CARD_META, rateCardMetaSummary } from '@/lib/delivery/rateCardMeta.core';

describe('rateCardMetaSummary (ARGUS #295)', () => {
  it('explains the initial state', () => {
    expect(rateCardMetaSummary(EMPTY_RATE_CARD_META)).toContain('not been changed');
    expect(rateCardMetaSummary(null)).toContain('not been changed');
  });

  it('shows who changed the base rates and that they apply immediately', () => {
    const text = rateCardMetaSummary({
      updatedAt: '2026-11-22T04:30:00.000Z',
      updatedByEmail: 'owner@shop.lk',
      updatedByRole: 'OWNER',
      action: 'card',
    });
    expect(text).toContain('Base rates updated');
    expect(text).toContain('Owner');
    expect(text).toContain('Effective immediately');
  });

  it('distinguishes a zone-matrix update', () => {
    expect(
      rateCardMetaSummary({
        updatedAt: '2026-11-22T04:30:00.000Z',
        updatedByEmail: 'manager@shop.lk',
        updatedByRole: 'MANAGER',
        action: 'entries',
      }),
    ).toContain('Zone overrides updated');
  });
});
