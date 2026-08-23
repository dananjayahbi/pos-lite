import { describe, expect, it } from 'vitest';

import { aggregateRecoveryStaff } from '../recovery-stats.service';
import { LogRecoveryActionSchema, RedeliverDeliverySchema, PermanentCancelDeliverySchema } from '@/lib/validators/recovery.validators';

const staff = { id: 'u1', email: 'staff@example.com', role: 'DISPATCH_STAFF' };

function attempt(action: string, staffId = 'u1') {
  return { staffId, action, staff: staffId === 'u1' ? staff : null };
}

describe('aggregateRecoveryStaff', () => {
  it('returns empty totals when there are no attempts', () => {
    const result = aggregateRecoveryStaff([], []);
    expect(result.staff).toEqual([]);
    expect(result.totals).toEqual({
      totalAttempts: 0,
      totalAssignedFailed: 0,
      totalRedelivered: 0,
      totalCancelled: 0,
      overallRecoveryRate: 0,
    });
  });

  it('counts actions per staff and computes assigned failed as distinct deliveries', () => {
    const result = aggregateRecoveryStaff(
      [
        attempt('FOLLOW_UP_CALL'),
        attempt('RESCHEDULED'),
        attempt('REDELIVERED'),
        attempt('CANCELLED'),
      ],
      [
        { staffId: 'u1', deliveryId: 'd1' },
        { staffId: 'u1', deliveryId: 'd2' },
      ],
    );

    expect(result.staff).toHaveLength(1);
    const row = result.staff[0];
    expect(row?.followUpCalls).toBe(1);
    expect(row?.rescheduled).toBe(1);
    expect(row?.redelivered).toBe(1);
    expect(row?.cancelled).toBe(1);
    expect(row?.totalAttempts).toBe(4);
    expect(row?.assignedFailed).toBe(2);
  });

  it('computes recovery rate as redelivered / (redelivered + cancelled)', () => {
    const result = aggregateRecoveryStaff([attempt('REDELIVERED'), attempt('CANCELLED')], []);
    const row = result.staff[0];
    expect(row?.recoveryRate).toBe(50);
    expect(result.totals.overallRecoveryRate).toBe(50);
  });

  it('gives a 0 recovery rate when there are no actionable outcomes', () => {
    const result = aggregateRecoveryStaff([attempt('FOLLOW_UP_CALL'), attempt('RESCHEDULED')], []);
    const row = result.staff[0];
    expect(row?.recoveryRate).toBe(0);
    expect(result.totals.overallRecoveryRate).toBe(0);
  });

  it('aggregates across multiple staff members', () => {
    const result = aggregateRecoveryStaff(
      [attempt('REDELIVERED', 'u1'), attempt('CANCELLED', 'u2')],
      [],
    );
    expect(result.staff).toHaveLength(2);
    expect(result.totals.totalRedelivered).toBe(1);
    expect(result.totals.totalCancelled).toBe(1);
    expect(result.totals.totalAttempts).toBe(2);
  });
});

describe('recovery validators', () => {
  it('accepts FOLLOW_UP_CALL with notes', () => {
    const parsed = LogRecoveryActionSchema.safeParse({ action: 'FOLLOW_UP_CALL', notes: 'called customer' });
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid action', () => {
    const parsed = LogRecoveryActionSchema.safeParse({ action: 'REDELIVERED' });
    expect(parsed.success).toBe(false);
  });

  it('defaults waybillMode to AUTO for redelivery', () => {
    const parsed = RedeliverDeliverySchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.data?.waybillMode).toBe('AUTO');
  });

  it('requires manual waybill id length when manual', () => {
    const parsed = RedeliverDeliverySchema.safeParse({ waybillMode: 'MANUAL', manualWaybillId: 'short' });
    expect(parsed.success).toBe(false);
  });

  it('accepts a reason for permanent cancel', () => {
    const parsed = PermanentCancelDeliverySchema.safeParse({ reason: 'recipient moved' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.reason).toBe('recipient moved');
  });
});
