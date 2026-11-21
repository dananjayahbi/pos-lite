import { describe, expect, it } from 'vitest';

import {
  appointmentCustomerLabel,
  formatAppointmentDate,
  formatAppointmentDateTime,
  formatAppointmentRelativeDate,
  formatAppointmentTime,
  formatAppointmentTimeRange,
} from '@/lib/appointments/appointmentDisplay.core';

describe('appointment date formatting', () => {
  it('renders dates day-first in en-GB', () => {
    const value = new Date(2026, 8, 7, 10, 0);

    expect(formatAppointmentDate(value)).toBe('07 Sep 2026');
    expect(formatAppointmentDate(value, { weekday: true, month: 'long' })).toContain('07 September 2026');
    expect(formatAppointmentDate(value, { year: false })).toBe('07 Sep');
  });

  it('renders 24-hour times and ranges', () => {
    expect(formatAppointmentTime(new Date(2026, 8, 7, 14, 5))).toBe('14:05');
    expect(
      formatAppointmentTimeRange(new Date(2026, 8, 7, 9, 30), new Date(2026, 8, 7, 10, 0)),
    ).toBe('09:30 - 10:00');
  });

  it('renders date-times day-first with a 24-hour time', () => {
    expect(formatAppointmentDateTime(new Date(2026, 8, 7, 14, 5))).toBe('07 Sep 2026, 14:05');
  });

  it('keeps the relative today/tomorrow labels in en-GB', () => {
    const now = new Date(2026, 8, 7, 9, 0);

    expect(formatAppointmentRelativeDate(new Date(2026, 8, 7, 14, 30), now)).toBe(
      'Today, 14:30',
    );
    expect(formatAppointmentRelativeDate(new Date(2026, 8, 8, 14, 30), now)).toBe(
      'Tomorrow, 14:30',
    );
    expect(formatAppointmentRelativeDate(new Date(2029, 8, 7, 10, 0), now)).toBe(
      '07 Sep 2029, 10:00',
    );
  });

  it('handles invalid input', () => {
    expect(formatAppointmentDate('not-a-date')).toBe('Unknown date');
    expect(formatAppointmentTime('not-a-date')).toBe('--:--');
    expect(formatAppointmentDateTime('not-a-date')).toBe('Unknown date');
  });
});

describe('appointmentCustomerLabel', () => {
  it('prefers the linked customer', () => {
    expect(
      appointmentCustomerLabel({ title: 'Consultation', customerName: 'Nimal', walkInName: 'QA' }),
    ).toBe('Nimal');
  });

  it('returns a normal walk-in name once', () => {
    expect(appointmentCustomerLabel({ title: 'Consultation', walkInName: 'Kamal' })).toBe('Kamal');
  });

  it('suppresses a walk-in name that merely repeats the title', () => {
    expect(
      appointmentCustomerLabel({ title: 'QA walk-in', walkInName: 'QA walk-in' }),
    ).toBeNull();
    expect(
      appointmentCustomerLabel({ title: 'qa walk-in', walkInName: ' QA walk-in ' }),
    ).toBeNull();
  });

  it('returns null with no customer data', () => {
    expect(appointmentCustomerLabel({ title: 'Consultation' })).toBeNull();
  });
});
