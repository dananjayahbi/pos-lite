/**
 * Self-service punch audit payloads (ARGUS #357).
 *
 * Clock-in and clock-out previously wrote no audit row, while manager
 * adjustments and status changes did. Every self punch now records the actor,
 * the method (`SELF`) and the exact timestamp. The payload references the
 * TimeClock row id so the payroll source record remains the single truth.
 */

export const SELF_PUNCH_METHOD = 'SELF';

export const SELF_PUNCH_ACTIONS = {
  IN: 'ATTENDANCE_CLOCKED_IN',
  OUT: 'ATTENDANCE_CLOCKED_OUT',
} as const;

export type SelfPunchDirection = keyof typeof SELF_PUNCH_ACTIONS;

export interface SelfPunchAuditInput {
  direction: SelfPunchDirection;
  userId: string;
  timeClockId: string;
  occurredAt: Date;
  shiftId?: string | null | undefined;
  durationMinutes?: number | undefined;
  cappedAtMaxShift?: boolean | undefined;
  notes?: string | null | undefined;
}

/** `after` JSON for the audit row. No payroll source row is modified. */
export function buildSelfPunchAuditAfter(
  input: SelfPunchAuditInput,
): Record<string, unknown> {
  return {
    method: SELF_PUNCH_METHOD,
    direction: input.direction,
    userId: input.userId,
    timeClockId: input.timeClockId,
    occurredAt: input.occurredAt.toISOString(),
    ...(input.shiftId ? { shiftId: input.shiftId } : {}),
    ...(input.durationMinutes !== undefined
      ? { durationMinutes: input.durationMinutes }
      : {}),
    ...(input.cappedAtMaxShift !== undefined
      ? { cappedAtMaxShift: input.cappedAtMaxShift }
      : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
}
