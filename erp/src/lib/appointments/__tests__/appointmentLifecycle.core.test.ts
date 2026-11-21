import { describe, expect, it } from 'vitest';

import type { AppointmentStatus } from '@/generated/prisma/client';
import {
  APPOINTMENT_ACTION_PERMISSIONS,
  appointmentActionAllowed,
  appointmentActionBlockReason,
  buildAppointmentRebookSeed,
  hasAppointmentActionPermission,
  type AppointmentLifecycleAction,
} from '@/lib/appointments/appointmentLifecycle.core';
import {
  DEFAULT_APPOINTMENT_SETTINGS,
  type AppointmentSettings,
} from '@/lib/appointments/appointmentSettings.core';
import { PERMISSIONS } from '@/lib/constants/permissions';

const REQUIRES_CONFIRMATION: AppointmentSettings = {
  ...DEFAULT_APPOINTMENT_SETTINGS,
  requireConfirmation: true,
};
const CONFIRMATION_OPTIONAL: AppointmentSettings = {
  ...DEFAULT_APPOINTMENT_SETTINGS,
  requireConfirmation: false,
};

describe('appointment lifecycle permissions', () => {
  it('matches the permission each API route enforces', () => {
    expect(APPOINTMENT_ACTION_PERMISSIONS.check_in).toEqual([
      PERMISSIONS.APPOINTMENT.checkInAppointment,
    ]);
    expect(APPOINTMENT_ACTION_PERMISSIONS.complete).toEqual([
      PERMISSIONS.APPOINTMENT.editAppointment,
    ]);
    expect(APPOINTMENT_ACTION_PERMISSIONS.start).toEqual([
      PERMISSIONS.APPOINTMENT.editAppointment,
    ]);
    expect(APPOINTMENT_ACTION_PERMISSIONS.no_show).toEqual([
      PERMISSIONS.APPOINTMENT.editAppointment,
    ]);
    expect(APPOINTMENT_ACTION_PERMISSIONS.cancel).toEqual([
      PERMISSIONS.APPOINTMENT.cancelAppointment,
    ]);
    expect(APPOINTMENT_ACTION_PERMISSIONS.rebook).toEqual([
      PERMISSIONS.APPOINTMENT.createAppointment,
    ]);
    // Conversion flips a lifecycle status AND writes a sale.
    expect(APPOINTMENT_ACTION_PERMISSIONS.convert_to_sale).toEqual([
      PERMISSIONS.APPOINTMENT.editAppointment,
      PERMISSIONS.SALE.createSale,
    ]);
  });

  it('requires every permission an action needs', () => {
    expect(
      hasAppointmentActionPermission('convert_to_sale', [
        PERMISSIONS.APPOINTMENT.editAppointment,
      ]),
    ).toBe(false);
    expect(
      hasAppointmentActionPermission('convert_to_sale', [
        PERMISSIONS.APPOINTMENT.editAppointment,
        PERMISSIONS.SALE.createSale,
      ]),
    ).toBe(true);
    expect(hasAppointmentActionPermission('cancel', [])).toBe(false);
    expect(
      hasAppointmentActionPermission('cancel', [PERMISSIONS.APPOINTMENT.cancelAppointment]),
    ).toBe(true);
  });
});

describe('appointmentActionAllowed', () => {
  const cases: Array<[AppointmentStatus, AppointmentLifecycleAction, boolean]> = [
    ['SCHEDULED', 'confirm', true],
    ['SCHEDULED', 'check_in', false],
    ['SCHEDULED', 'start', false],
    ['SCHEDULED', 'complete', false],
    ['SCHEDULED', 'no_show', true],
    ['SCHEDULED', 'cancel', true],
    ['CONFIRMED', 'check_in', true],
    ['CONFIRMED', 'start', false],
    ['CONFIRMED', 'complete', false],
    ['CONFIRMED', 'no_show', true],
    ['CHECKED_IN', 'start', true],
    ['CHECKED_IN', 'complete', true],
    ['CHECKED_IN', 'no_show', true],
    ['IN_PROGRESS', 'complete', true],
    ['IN_PROGRESS', 'start', false],
    ['COMPLETED', 'complete', false],
    ['COMPLETED', 'cancel', false],
    ['NO_SHOW', 'cancel', false],
    ['CANCELLED', 'check_in', false],
  ];

  it('follows the canonical transition map with confirmation required', () => {
    for (const [status, action, expected] of cases) {
      expect(appointmentActionAllowed(status, action, REQUIRES_CONFIRMATION), `${status} → ${action}`).toBe(
        expected,
      );
    }
  });

  it('lets a SCHEDULED booking be checked in or completed directly when confirmation is optional', () => {
    expect(appointmentActionAllowed('SCHEDULED', 'check_in', CONFIRMATION_OPTIONAL)).toBe(true);
    expect(appointmentActionAllowed('SCHEDULED', 'complete', CONFIRMATION_OPTIONAL)).toBe(true);
  });

  it('allows rebook only from a terminal missed/cancelled booking', () => {
    expect(appointmentActionAllowed('NO_SHOW', 'rebook', REQUIRES_CONFIRMATION)).toBe(true);
    expect(appointmentActionAllowed('CANCELLED', 'rebook', REQUIRES_CONFIRMATION)).toBe(true);
    expect(appointmentActionAllowed('SCHEDULED', 'rebook', REQUIRES_CONFIRMATION)).toBe(false);
    expect(appointmentActionAllowed('COMPLETED', 'rebook', REQUIRES_CONFIRMATION)).toBe(false);
  });

  it('allows conversion only from COMPLETED', () => {
    expect(appointmentActionAllowed('COMPLETED', 'convert_to_sale', REQUIRES_CONFIRMATION)).toBe(true);
    expect(appointmentActionAllowed('IN_PROGRESS', 'convert_to_sale', REQUIRES_CONFIRMATION)).toBe(false);
  });
});

describe('appointmentActionBlockReason', () => {
  it('returns the service sentinel for an illegal edge', () => {
    expect(appointmentActionBlockReason('SCHEDULED', 'check_in', REQUIRES_CONFIRMATION)).toBe(
      'INVALID_STATUS_TRANSITION',
    );
    expect(appointmentActionBlockReason('SCHEDULED', 'check_in', CONFIRMATION_OPTIONAL)).toBeNull();
    expect(appointmentActionBlockReason('CHECKED_IN', 'start', REQUIRES_CONFIRMATION)).toBeNull();
  });
});

describe('buildAppointmentRebookSeed', () => {
  it('creates a new one-week-later booking with the same customer/service/staff', () => {
    const seed = buildAppointmentRebookSeed({
      startTime: '2026-10-29T09:30:00.000Z',
      durationMins: 45,
      customerId: 'cust_1',
      serviceId: 'svc_1',
      staffId: 'staff_1',
      title: 'Follow-up',
      price: '1500.00',
      walkInName: null,
      walkInPhone: null,
      notes: 'original note',
      customerNotes: 'customer note',
    });

    expect(seed.startTime).toBe('2026-11-05T09:30:00.000Z');
    expect(seed.endTime).toBe('2026-11-05T10:15:00.000Z');
    expect(seed).toMatchObject({
      customerId: 'cust_1',
      serviceId: 'svc_1',
      staffId: 'staff_1',
      durationMins: 45,
      price: 1500,
      title: 'Follow-up',
      notes: 'original note',
      customerNotes: 'customer note',
    });
  });

  it('carries walk-in details and defaults a missing duration to 30 minutes', () => {
    const seed = buildAppointmentRebookSeed({
      startTime: '2026-10-29T09:30:00.000Z',
      durationMins: 0,
      title: 'Walk-in',
      price: 0,
      walkInName: 'Nimal',
      walkInPhone: '0771234567',
    });

    expect(seed.durationMins).toBe(30);
    expect(seed.endTime).toBe('2026-11-05T10:00:00.000Z');
    expect(seed.walkInName).toBe('Nimal');
    expect(seed.walkInPhone).toBe('0771234567');
    expect(seed.customerId).toBeNull();
    expect(seed.serviceId).toBeNull();
  });
});
