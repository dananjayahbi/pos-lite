import { describe, expect, it } from 'vitest';

import {
  isReprintRequest,
  reprintIdentityNotice,
  REPRINT_IDENTITY_NOTICE,
} from '@/lib/receipt-identity.core';

/**
 * ARGUS #472: receipt store identity is current, not snapshotted. A reprint
 * must say so explicitly; an original print stays clean.
 */
describe('receipt reprint identity caveat', () => {
  it('returns the caveat only for a reprint', () => {
    expect(reprintIdentityNotice(true)).toBe(REPRINT_IDENTITY_NOTICE);
    expect(reprintIdentityNotice(false)).toBeNull();
    expect(reprintIdentityNotice(undefined)).toBeNull();
  });

  it('mentions that store details are current rather than historical', () => {
    expect(REPRINT_IDENTITY_NOTICE).toContain('Reprint');
    expect(REPRINT_IDENTITY_NOTICE).toContain('current profile');
    expect(REPRINT_IDENTITY_NOTICE).toContain('time of sale');
  });

  it.each(['1', 'true'])('treats %s as a reprint request', (value) => {
    expect(isReprintRequest(value)).toBe(true);
  });

  it.each([null, undefined, '', '0', 'false', 'yes'])(
    'does not mark %s as a reprint request',
    (value) => {
      expect(isReprintRequest(value)).toBe(false);
    },
  );
});
