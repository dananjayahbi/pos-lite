import { describe, expect, it } from 'vitest';
import { createCommissionPayout } from '@/lib/services/commission.service';

/**
 * ARGUS #347: the payout contract changed (paymentAccountId is required) while
 * the old E2E payload still omitted it. This pins the API-level rejection before
 * any database write.
 */
describe('commission payout contract', () => {
  it('rejects a payout without a payment account', async () => {
    await expect(
      createCommissionPayout({
        tenantId: 'tenant-1',
        userId: 'user-1',
        periodStart: new Date('2026-11-01T00:00:00.000Z'),
        periodEnd: new Date('2026-11-30T23:59:59.999Z'),
        authorizedById: 'owner-1',
        authorizedByRole: 'OWNER',
        notes: 'no account',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
  });
});
