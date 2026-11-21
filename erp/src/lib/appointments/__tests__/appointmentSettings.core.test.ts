import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPOINTMENT_SETTINGS,
  isAppointmentTransitionAllowedBySettings,
  normalizeAppointmentSettings,
  parseAppointmentSettings,
  resolveInitialAppointmentStatus,
} from '@/lib/appointments/appointmentSettings.core';

describe('parseAppointmentSettings', () => {
  it('returns the documented defaults when nothing is saved', () => {
    expect(parseAppointmentSettings(null)).toEqual(DEFAULT_APPOINTMENT_SETTINGS);
    expect(parseAppointmentSettings({})).toEqual(DEFAULT_APPOINTMENT_SETTINGS);
    expect(parseAppointmentSettings({ appointments: {} })).toEqual(DEFAULT_APPOINTMENT_SETTINGS);
  });

  it('reads the blob written by the Settings tab', () => {
    const settings = parseAppointmentSettings({
      appointments: {
        settings: {
          slotDurationMins: 45,
          reminder24hEnabled: false,
          reminder2hEnabled: true,
          autoConfirmOnBooking: true,
          requireConfirmation: false,
        },
      },
    });

    expect(settings).toEqual({
      slotDurationMins: 45,
      reminder24hEnabled: false,
      reminder2hEnabled: true,
      autoConfirmOnBooking: true,
      requireConfirmation: false,
    });
  });

  it('falls back per field instead of failing on a corrupt blob', () => {
    const settings = parseAppointmentSettings({
      appointments: { settings: { slotDurationMins: 'nonsense', reminder24hEnabled: 'yes' } },
    });

    expect(settings.slotDurationMins).toBe(DEFAULT_APPOINTMENT_SETTINGS.slotDurationMins);
    expect(settings.reminder24hEnabled).toBe(DEFAULT_APPOINTMENT_SETTINGS.reminder24hEnabled);
  });

  it('clamps the slot duration to 5..120 minutes', () => {
    const read = (value: unknown) =>
      parseAppointmentSettings({ appointments: { settings: { slotDurationMins: value } } })
        .slotDurationMins;

    expect(read(1)).toBe(5);
    expect(read(600)).toBe(120);
    expect(read(29.6)).toBe(30);
    expect(read('45')).toBe(45);
  });

  it('ignores non-object blobs', () => {
    expect(
      parseAppointmentSettings({ appointments: { settings: ['nope'] } }),
    ).toEqual(DEFAULT_APPOINTMENT_SETTINGS);
  });
});

describe('normalizeAppointmentSettings', () => {
  it('fills missing fields with defaults', () => {
    expect(normalizeAppointmentSettings({ slotDurationMins: 20 })).toEqual({
      ...DEFAULT_APPOINTMENT_SETTINGS,
      slotDurationMins: 20,
    });
  });

  it('clamps out-of-range durations', () => {
    expect(normalizeAppointmentSettings({ slotDurationMins: 0 }).slotDurationMins).toBe(5);
    expect(normalizeAppointmentSettings({ slotDurationMins: 1000 }).slotDurationMins).toBe(120);
  });
});

describe('resolveInitialAppointmentStatus', () => {
  it('keeps new bookings SCHEDULED by default', () => {
    expect(resolveInitialAppointmentStatus(DEFAULT_APPOINTMENT_SETTINGS)).toBe('SCHEDULED');
  });

  it('confirms new bookings when auto-confirm is on', () => {
    expect(
      resolveInitialAppointmentStatus({ ...DEFAULT_APPOINTMENT_SETTINGS, autoConfirmOnBooking: true }),
    ).toBe('CONFIRMED');
  });

  it('confirms new bookings when confirmation is not required', () => {
    expect(
      resolveInitialAppointmentStatus({ ...DEFAULT_APPOINTMENT_SETTINGS, requireConfirmation: false }),
    ).toBe('CONFIRMED');
  });
});

describe('isAppointmentTransitionAllowedBySettings', () => {
  it('matches the canonical lifecycle map with default settings', () => {
    expect(isAppointmentTransitionAllowedBySettings('SCHEDULED', 'CONFIRMED', DEFAULT_APPOINTMENT_SETTINGS)).toBe(true);
    expect(isAppointmentTransitionAllowedBySettings('SCHEDULED', 'CHECKED_IN', DEFAULT_APPOINTMENT_SETTINGS)).toBe(false);
    expect(isAppointmentTransitionAllowedBySettings('COMPLETED', 'CANCELLED', DEFAULT_APPOINTMENT_SETTINGS)).toBe(false);
  });

  it('allows skipping the confirmation step when it is not required', () => {
    const settings = { ...DEFAULT_APPOINTMENT_SETTINGS, requireConfirmation: false };
    expect(isAppointmentTransitionAllowedBySettings('SCHEDULED', 'CHECKED_IN', settings)).toBe(true);
    expect(isAppointmentTransitionAllowedBySettings('SCHEDULED', 'COMPLETED', settings)).toBe(true);
    // Still no resurrection of terminal rows.
    expect(isAppointmentTransitionAllowedBySettings('CANCELLED', 'CONFIRMED', settings)).toBe(false);
  });

  it('keeps the terminal states terminal even without confirmation', () => {
    const settings = { ...DEFAULT_APPOINTMENT_SETTINGS, requireConfirmation: false };
    expect(isAppointmentTransitionAllowedBySettings('COMPLETED', 'CANCELLED', settings)).toBe(false);
    expect(isAppointmentTransitionAllowedBySettings('NO_SHOW', 'CHECKED_IN', settings)).toBe(false);
  });
});
