import { describe, expect, it } from 'vitest';

import {
  appointmentSlotDefaults,
  selectMonthViewAppointments,
  type CalendarAppointmentLike,
} from '@/lib/appointments/appointmentCalendar.core';

function appointment(
  id: string,
  status: string,
  overrides: Partial<CalendarAppointmentLike> = {},
): CalendarAppointmentLike {
  return {
    id,
    status,
    startTime: new Date(2026, 8, 7, 10, 0),
    title: 'Consultation',
    ...overrides,
  };
}

describe('selectMonthViewAppointments', () => {
  it('hides cancelled rows from the month grid', () => {
    const result = selectMonthViewAppointments([
      appointment('keep', 'CONFIRMED'),
      appointment('cancelled', 'CANCELLED'),
    ]);

    expect(result.visible.map((row) => row.id)).toEqual(['keep']);
    expect(result.hiddenCount).toBe(1);
  });

  it('collapses QA fixtures even when they are still active', () => {
    const result = selectMonthViewAppointments([
      appointment('real', 'SCHEDULED', { title: 'Ayurvedic consultation' }),
      appointment('qa', 'SCHEDULED', { title: 'QA walk-in' }),
      appointment('test', 'NO_SHOW', { title: 'Test booking' }),
      appointment('walk-in', 'SCHEDULED', { title: 'Consultation', walkInName: 'QA F8done' }),
    ]);

    expect(result.visible.map((row) => row.id)).toEqual(['real']);
    expect(result.hiddenCount).toBe(3);
  });

  it('keeps normal completed and no-show rows', () => {
    const result = selectMonthViewAppointments([
      appointment('completed', 'COMPLETED'),
      appointment('no-show', 'NO_SHOW', { title: 'Deep tissue massage' }),
    ]);

    expect(result.visible).toHaveLength(2);
    expect(result.hiddenCount).toBe(0);
  });
});

describe('appointmentSlotDefaults', () => {
  it('uses the clicked slot as the start and adds the default duration', () => {
    const clicked = new Date(2026, 8, 7, 14, 30, 0, 0);
    const result = appointmentSlotDefaults(clicked);

    expect(new Date(result.startTime).getTime()).toBe(clicked.getTime());
    expect(new Date(result.endTime).getTime() - clicked.getTime()).toBe(30 * 60 * 1000);
  });

  it('honours a custom duration without mutating the clicked date', () => {
    const clicked = new Date(2026, 8, 7, 9, 0, 0, 0);
    const result = appointmentSlotDefaults(clicked, 45);

    expect(new Date(result.endTime).getTime() - new Date(result.startTime).getTime()).toBe(
      45 * 60 * 1000,
    );
    expect(clicked.getHours()).toBe(9);
  });
});
