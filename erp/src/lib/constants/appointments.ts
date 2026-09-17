import type { AppointmentStatus } from '@/generated/prisma/client';

/**
 * M27-04 / BUG-88 — legal appointment status transitions (req 3.3 pipeline).
 *
 * The PATCH route previously wrote whatever `status` the client sent, so illegal
 * jumps were accepted (SCHEDULED→COMPLETED skipping check-in, COMPLETED→CANCELLED
 * erasing a completed visit from revenue). This map is the single source of truth
 * for which edges the lifecycle may take; every state not listed as a key (or
 * with an empty successor set) is terminal.
 *
 * The action sub-routes (confirm/check-in/complete/no-show/cancel) already walk
 * these same edges — this map restricts the generic PATCH to them.
 */
export const APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  // Terminal states — a correction is a new booking, not an edit.
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** States from which no further transition (and no field edit) is allowed. */
export const APPOINTMENT_TERMINAL_STATUSES: AppointmentStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export function isAppointmentStatusTransitionAllowed(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (from === to) return true;
  return (APPOINTMENT_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * OBS-79 / M27-04 backdating policy: a booking may be recorded up to this many
 * minutes in the past (record-after-the-fact walk-in), beyond which it is
 * rejected unless the caller holds `appointment:settings:manage`.
 */
export const APPOINTMENT_BACKDATE_GRACE_MINUTES = 15;