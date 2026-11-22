import { describe, expect, it } from 'vitest';

import {
  BROADCAST_MAX_RECIPIENTS,
  broadcastAudienceLimitMessage,
  isBroadcastAudienceTooLarge,
} from '@/lib/services/broadcastAudience.core';

/** ARGUS #320: the current send path keeps the legacy 200-recipient cap. */
describe('broadcast audience cap', () => {
  it('exposes the 200-recipient ceiling', () => {
    expect(BROADCAST_MAX_RECIPIENTS).toBe(200);
  });

  it('allows exactly the cap and rejects one more', () => {
    expect(isBroadcastAudienceTooLarge(0)).toBe(false);
    expect(isBroadcastAudienceTooLarge(200)).toBe(false);
    expect(isBroadcastAudienceTooLarge(201)).toBe(true);
    expect(isBroadcastAudienceTooLarge(5000)).toBe(true);
  });

  it('ignores a non-finite total', () => {
    expect(isBroadcastAudienceTooLarge(Number.NaN)).toBe(false);
  });

  it('names the actual total and the limit in the error message', () => {
    const message = broadcastAudienceLimitMessage(512);
    expect(message).toContain('512');
    expect(message).toContain('200');
    expect(message).toMatch(/narrow the filters/i);
  });
});
