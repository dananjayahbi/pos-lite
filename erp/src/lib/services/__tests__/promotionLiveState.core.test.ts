import { describe, expect, it } from 'vitest';

import {
  getPromotionLiveState,
  isPromotionLive,
  summarizePromotionLiveStates,
} from '@/lib/services/promotionLiveState.core';

/** ARGUS #329: the switch alone must not claim an expired/future row is live. */
const NOW = new Date('2026-11-20T12:00:00.000Z');

const base = { isActive: true, startsAt: null, endsAt: null };

describe('getPromotionLiveState', () => {
  it('is ENABLED for an on, open-ended promotion', () => {
    expect(getPromotionLiveState(base, NOW)).toBe('ENABLED');
  });

  it('is INACTIVE when the master switch is off, even inside a window', () => {
    expect(
      getPromotionLiveState(
        { isActive: false, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' },
        NOW,
      ),
    ).toBe('INACTIVE');
  });

  it('is SCHEDULED when the start is in the future', () => {
    expect(
      getPromotionLiveState({ ...base, startsAt: '2026-12-01T00:00:00Z' }, NOW),
    ).toBe('SCHEDULED');
  });

  it('is ACTIVE_NOW inside the window', () => {
    expect(
      getPromotionLiveState(
        { ...base, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' },
        NOW,
      ),
    ).toBe('ACTIVE_NOW');
  });

  it('is ACTIVE_NOW for a one-sided window that has started', () => {
    expect(getPromotionLiveState({ ...base, startsAt: '2026-11-01T00:00:00Z' }, NOW)).toBe(
      'ACTIVE_NOW',
    );
    expect(getPromotionLiveState({ ...base, endsAt: '2026-12-01T00:00:00Z' }, NOW)).toBe(
      'ACTIVE_NOW',
    );
  });

  it('is EXPIRED once the end has passed', () => {
    expect(
      getPromotionLiveState(
        { ...base, startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' },
        NOW,
      ),
    ).toBe('EXPIRED');
  });

  it('treats an invalid legacy date as an open bound instead of crashing', () => {
    expect(getPromotionLiveState({ ...base, endsAt: 'not-a-date' }, NOW)).toBe('ENABLED');
  });

  it('marks only enabled/active-now as live', () => {
    expect(isPromotionLive('ENABLED')).toBe(true);
    expect(isPromotionLive('ACTIVE_NOW')).toBe(true);
    expect(isPromotionLive('SCHEDULED')).toBe(false);
    expect(isPromotionLive('EXPIRED')).toBe(false);
    expect(isPromotionLive('INACTIVE')).toBe(false);
  });
});

describe('summarizePromotionLiveStates', () => {
  it('counts each state and excludes expired rows from the scheduled count', () => {
    const counts = summarizePromotionLiveStates(
      [
        { isActive: true, startsAt: null, endsAt: null },
        { isActive: true, startsAt: '2026-12-01T00:00:00Z', endsAt: null },
        { isActive: true, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' },
        { isActive: true, startsAt: null, endsAt: '2026-11-01T00:00:00Z' },
        { isActive: false, startsAt: null, endsAt: null },
      ],
      NOW,
    );

    expect(counts).toEqual({
      inactive: 1,
      enabled: 1,
      scheduled: 1,
      activeNow: 1,
      expired: 1,
      live: 2,
    });
  });
});
