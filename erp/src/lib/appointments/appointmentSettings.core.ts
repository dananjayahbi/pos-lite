import type { AppointmentStatus } from '@/generated/prisma/client';
import { isAppointmentStatusTransitionAllowed } from '@/lib/constants/appointments';

/**
 * ARGUS #124 — the appointment Settings tab was static markup: no state, no
 * save, no API, and nothing it displayed affected scheduling. The values now
 * live in the tenant's settings JSON under `settings.appointments.settings`
 * (no schema migration) and are read by the booking/reminder/availability
 * paths below.
 *
 * Every field has a default that preserves the pre-existing behaviour, so a
 * tenant that never saves the form behaves exactly as before.
 */
export interface AppointmentSettings {
  /** Slot length used when availability omits an explicit duration. */
  slotDurationMins: number;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  /** New bookings are created CONFIRMED instead of SCHEDULED. */
  autoConfirmOnBooking: boolean;
  /**
   * Keep new bookings in SCHEDULED until staff confirm them. When false the
   * booking is created CONFIRMED and the confirmation step may be skipped.
   */
  requireConfirmation: boolean;
}

export const DEFAULT_APPOINTMENT_SETTINGS: AppointmentSettings = {
  slotDurationMins: 30,
  reminder24hEnabled: true,
  reminder2hEnabled: true,
  autoConfirmOnBooking: false,
  requireConfirmation: true,
};

export const APPOINTMENT_SLOT_DURATION_MIN = 5;
export const APPOINTMENT_SLOT_DURATION_MAX = 120;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `settings.appointments.settings` — the blob written by the Settings tab. */
function readRawBlob(settings: unknown): JsonRecord | null {
  if (!isRecord(settings)) return null;
  const appointments = settings.appointments;
  if (!isRecord(appointments)) return null;
  const blob = appointments.settings;
  return isRecord(blob) ? blob : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readSlotDuration(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded < APPOINTMENT_SLOT_DURATION_MIN) return APPOINTMENT_SLOT_DURATION_MIN;
  if (rounded > APPOINTMENT_SLOT_DURATION_MAX) return APPOINTMENT_SLOT_DURATION_MAX;
  return rounded;
}

/**
 * Read the effective settings from the tenant's `settings` JSON. Unknown or
 * corrupt values fall back per-field, so a partial/hand-edited blob can never
 * break booking.
 */
export function parseAppointmentSettings(settings: unknown): AppointmentSettings {
  const blob = readRawBlob(settings) ?? {};
  return {
    slotDurationMins: readSlotDuration(
      blob.slotDurationMins,
      DEFAULT_APPOINTMENT_SETTINGS.slotDurationMins,
    ),
    reminder24hEnabled: readBoolean(
      blob.reminder24hEnabled,
      DEFAULT_APPOINTMENT_SETTINGS.reminder24hEnabled,
    ),
    reminder2hEnabled: readBoolean(
      blob.reminder2hEnabled,
      DEFAULT_APPOINTMENT_SETTINGS.reminder2hEnabled,
    ),
    autoConfirmOnBooking: readBoolean(
      blob.autoConfirmOnBooking,
      DEFAULT_APPOINTMENT_SETTINGS.autoConfirmOnBooking,
    ),
    requireConfirmation: readBoolean(
      blob.requireConfirmation,
      DEFAULT_APPOINTMENT_SETTINGS.requireConfirmation,
    ),
  };
}

/** Coerce and clamp a submitted payload into a storable full settings object. */
export function normalizeAppointmentSettings(input: Partial<AppointmentSettings>): AppointmentSettings {
  return parseAppointmentSettings({
    appointments: {
      settings: {
        slotDurationMins: input.slotDurationMins ?? DEFAULT_APPOINTMENT_SETTINGS.slotDurationMins,
        reminder24hEnabled:
          input.reminder24hEnabled ?? DEFAULT_APPOINTMENT_SETTINGS.reminder24hEnabled,
        reminder2hEnabled:
          input.reminder2hEnabled ?? DEFAULT_APPOINTMENT_SETTINGS.reminder2hEnabled,
        autoConfirmOnBooking:
          input.autoConfirmOnBooking ?? DEFAULT_APPOINTMENT_SETTINGS.autoConfirmOnBooking,
        requireConfirmation:
          input.requireConfirmation ?? DEFAULT_APPOINTMENT_SETTINGS.requireConfirmation,
      },
    },
  });
}

/**
 * Status a brand-new booking starts in. `autoConfirmOnBooking` is the explicit
 * override; turning "require confirmation" off has the same effect.
 */
export function resolveInitialAppointmentStatus(
  settings: AppointmentSettings,
): AppointmentStatus {
  return settings.autoConfirmOnBooking || !settings.requireConfirmation
    ? 'CONFIRMED'
    : 'SCHEDULED';
}

/**
 * The lifecycle map plus the settings-controlled edges:
 *
 * - with `requireConfirmation` off, a SCHEDULED booking may be checked in or
 *   completed directly — the confirmation step is optional;
 * - everything else follows the canonical transition map, so the default
 *   settings reproduce the pre-existing behaviour exactly.
 */
export function isAppointmentTransitionAllowedBySettings(
  from: AppointmentStatus,
  to: AppointmentStatus,
  settings: AppointmentSettings,
): boolean {
  if (from === to) return true;
  if (!settings.requireConfirmation && from === 'SCHEDULED') {
    if (to === 'CHECKED_IN' || to === 'COMPLETED') return true;
  }
  return isAppointmentStatusTransitionAllowed(from, to);
}
