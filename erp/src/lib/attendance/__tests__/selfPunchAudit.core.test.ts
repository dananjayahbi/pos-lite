/**
 * ARGUS #357 — every self punch has an audit payload.
 */
import { describe, expect, it } from 'vitest';
import {
  SELF_PUNCH_ACTIONS,
  SELF_PUNCH_METHOD,
  buildSelfPunchAuditAfter,
} from '@/lib/attendance/selfPunchAudit.core';

describe('self punch audit', () => {
  it('uses distinct clock-in and clock-out actions', () => {
    expect(SELF_PUNCH_ACTIONS.IN).toBe('ATTENDANCE_CLOCKED_IN');
    expect(SELF_PUNCH_ACTIONS.OUT).toBe('ATTENDANCE_CLOCKED_OUT');
    expect(SELF_PUNCH_ACTIONS.IN).not.toBe(SELF_PUNCH_ACTIONS.OUT);
  });

  it('records the actor, method and exact clock-in timestamp', () => {
    const occurredAt = new Date('2026-11-06T03:30:00.000Z');
    const after = buildSelfPunchAuditAfter({
      direction: 'IN',
      userId: 'user-1',
      timeClockId: 'punch-1',
      occurredAt,
    });

    expect(after).toMatchObject({
      method: SELF_PUNCH_METHOD,
      direction: 'IN',
      userId: 'user-1',
      timeClockId: 'punch-1',
      occurredAt: '2026-11-06T03:30:00.000Z',
    });
  });

  it('records duration and capping on clock-out without changing the source row', () => {
    const after = buildSelfPunchAuditAfter({
      direction: 'OUT',
      userId: 'user-1',
      timeClockId: 'punch-1',
      occurredAt: new Date('2026-11-06T11:30:00.000Z'),
      durationMinutes: 480,
      cappedAtMaxShift: false,
      notes: 'end of shift',
    });

    expect(after).toEqual({
      method: 'SELF',
      direction: 'OUT',
      userId: 'user-1',
      timeClockId: 'punch-1',
      occurredAt: '2026-11-06T11:30:00.000Z',
      durationMinutes: 480,
      cappedAtMaxShift: false,
      notes: 'end of shift',
    });
    // The payload references the payroll source record; it never replaces it.
    expect(after).not.toHaveProperty('clockedInAt');
    expect(after).not.toHaveProperty('clockedOutAt');
  });

  it('includes a shift when one was supplied', () => {
    const after = buildSelfPunchAuditAfter({
      direction: 'IN',
      userId: 'user-1',
      timeClockId: 'punch-1',
      occurredAt: new Date('2026-11-06T03:30:00.000Z'),
      shiftId: 'shift-1',
    });
    expect(after.shiftId).toBe('shift-1');
  });
});
