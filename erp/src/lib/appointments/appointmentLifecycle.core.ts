import type { AppointmentStatus } from '@/generated/prisma/client';
import type { AppointmentSettings } from '@/lib/appointments/appointmentSettings.core';
import { isAppointmentTransitionAllowedBySettings } from '@/lib/appointments/appointmentSettings.core';
import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';

/**
 * ARGUS #125 — the appointment lifecycle actions exposed by the UI and guarded
 * by the API.
 *
 * The canonical transition map is the single source of truth for which status
 * edges are legal; the settings-aware wrapper adds the ARGUS #124
 * "confirmation optional" edges. This module keeps the UI's action list and the
 * API's service guards aligned instead of duplicating the rules.
 */
export type AppointmentLifecycleAction =
  | 'confirm'
  | 'check_in'
  | 'start'
  | 'complete'
  | 'no_show'
  | 'cancel'
  | 'rebook'
  | 'convert_to_sale';

/** Status each action writes. Rebook/conversion are not status transitions. */
export const APPOINTMENT_ACTION_TARGET: Partial<Record<AppointmentLifecycleAction, AppointmentStatus>> = {
  confirm: 'CONFIRMED',
  check_in: 'CHECKED_IN',
  start: 'IN_PROGRESS',
  complete: 'COMPLETED',
  no_show: 'NO_SHOW',
  cancel: 'CANCELLED',
};

/**
 * The permissions the sibling API routes enforce. Conversion needs both the
 * lifecycle edit and the sale-create key, exactly like
 * `/appointments/[id]/convert-to-sale`.
 */
export const APPOINTMENT_ACTION_PERMISSIONS: Record<
  AppointmentLifecycleAction,
  readonly PermissionKey[]
> = {
  confirm: [PERMISSIONS.APPOINTMENT.editAppointment],
  check_in: [PERMISSIONS.APPOINTMENT.checkInAppointment],
  start: [PERMISSIONS.APPOINTMENT.editAppointment],
  complete: [PERMISSIONS.APPOINTMENT.editAppointment],
  no_show: [PERMISSIONS.APPOINTMENT.editAppointment],
  cancel: [PERMISSIONS.APPOINTMENT.cancelAppointment],
  rebook: [PERMISSIONS.APPOINTMENT.createAppointment],
  convert_to_sale: [
    PERMISSIONS.APPOINTMENT.editAppointment,
    PERMISSIONS.SALE.createSale,
  ],
};

export function hasAppointmentActionPermission(
  action: AppointmentLifecycleAction,
  grantedPermissions: readonly string[],
): boolean {
  return APPOINTMENT_ACTION_PERMISSIONS[action].every((permission) =>
    grantedPermissions.includes(permission),
  );
}

/**
 * Whether the action is legal from `status` under the effective settings.
 * Rebook is a new booking from a terminal row; conversion requires COMPLETED
 * (the caller still has to check that no sale is already attached).
 */
export function appointmentActionAllowed(
  status: AppointmentStatus,
  action: AppointmentLifecycleAction,
  settings: AppointmentSettings,
): boolean {
  if (action === 'rebook') return status === 'NO_SHOW' || status === 'CANCELLED';
  if (action === 'convert_to_sale') return status === 'COMPLETED';

  const target = APPOINTMENT_ACTION_TARGET[action];
  if (!target) return false;
  // An action that writes the current status is not an available action; the
  // generic PATCH still treats a same-status write as a harmless no-op.
  if (status === target) return false;
  return isAppointmentTransitionAllowedBySettings(status, target, settings);
}

/**
 * Service-side guard reason. The action routes throw this sentinel so a direct
 * API call cannot skip the lifecycle (for example complete a SCHEDULED booking
 * when confirmation is required).
 */
export function appointmentActionBlockReason(
  status: AppointmentStatus,
  action: AppointmentLifecycleAction,
  settings: AppointmentSettings,
): 'INVALID_STATUS_TRANSITION' | null {
  return appointmentActionAllowed(status, action, settings)
    ? null
    : 'INVALID_STATUS_TRANSITION';
}

// ── Rebook ───────────────────────────────────────────────────────────────────

export const APPOINTMENT_REBOOK_WEEKS_AHEAD = 1;

export interface AppointmentRebookSource {
  startTime: string | Date;
  durationMins: number;
  customerId?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  title: string;
  price: number | string;
  walkInName?: string | null;
  walkInPhone?: string | null;
  notes?: string | null;
  customerNotes?: string | null;
}

export interface AppointmentRebookSeed {
  startTime: string;
  endTime: string;
  customerId: string | null;
  serviceId: string | null;
  staffId: string | null;
  durationMins: number;
  price: number;
  title: string;
  walkInName: string;
  walkInPhone: string;
  notes: string;
  customerNotes: string;
}

/**
 * ARGUS #125: "Rebook" used to call the check-in endpoint, turning the archived
 * NO_SHOW into CHECKED_IN. It must create a NEW booking: same customer, service
 * and staff, moved forward one week so it is not a backdated duplicate.
 */
export function buildAppointmentRebookSeed(
  source: AppointmentRebookSource,
  options: { weeksAhead?: number } = {},
): AppointmentRebookSeed {
  const weeksAhead = options.weeksAhead ?? APPOINTMENT_REBOOK_WEEKS_AHEAD;
  const start = new Date(source.startTime);
  start.setDate(start.getDate() + weeksAhead * 7);

  const durationMins = Number(source.durationMins) > 0 ? Number(source.durationMins) : 30;
  const end = new Date(start.getTime() + durationMins * 60_000);

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    customerId: source.customerId ?? null,
    serviceId: source.serviceId ?? null,
    staffId: source.staffId ?? null,
    durationMins,
    price: Number(source.price) || 0,
    title: source.title,
    walkInName: source.walkInName ?? '',
    walkInPhone: source.walkInPhone ?? '',
    notes: source.notes ?? '',
    customerNotes: source.customerNotes ?? '',
  };
}
