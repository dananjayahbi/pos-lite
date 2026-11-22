import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES,
  appointmentAvailabilityIssue,
  type AppointmentAvailabilityInput,
} from '@/lib/appointments/appointmentAvailability.core';

const WEDNESDAY_10 = new Date(2026, 9, 28, 10, 0, 0);
const WEDNESDAY_AVAILABILITY = [
  { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isAvailable: true },
];

function input(overrides: Partial<AppointmentAvailabilityInput> = {}): AppointmentAvailabilityInput {
  return {
    startTime: WEDNESDAY_10,
    endTime: new Date(2026, 9, 28, 11, 0, 0),
    availability: WEDNESDAY_AVAILABILITY,
    ...overrides,
  };
}

describe('appointmentAvailabilityIssue', () => {
  it('accepts a slot inside the staff member\'s window', () => {
    expect(appointmentAvailabilityIssue(input())).toBeNull();
  });

  it('rejects a day with no availability', () => {
    const thursday = new Date(2026, 9, 29, 10, 0, 0);
    const issue = appointmentAvailabilityIssue(
      input({ startTime: thursday, endTime: new Date(2026, 9, 29, 11, 0, 0) }),
    );
    expect(issue).toEqual({
      code: 'NO_AVAILABILITY',
      message: APPOINTMENT_AVAILABILITY_ISSUE_MESSAGES.NO_AVAILABILITY,
    });
  });

  it('rejects a day whose availability row is switched off', () => {
    const issue = appointmentAvailabilityIssue(
      input({
        availability: [{ dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isAvailable: false }],
      }),
    );
    expect(issue?.code).toBe('NO_AVAILABILITY');
  });

  it('rejects a start before the window and an end after it', () => {
    expect(
      appointmentAvailabilityIssue(
        input({
          startTime: new Date(2026, 9, 28, 8, 30, 0),
          endTime: new Date(2026, 9, 28, 9, 30, 0),
        }),
      )?.code,
    ).toBe('OUTSIDE_AVAILABILITY');

    expect(
      appointmentAvailabilityIssue(
        input({
          startTime: new Date(2026, 9, 28, 16, 30, 0),
          endTime: new Date(2026, 9, 28, 17, 30, 0),
        }),
      )?.code,
    ).toBe('OUTSIDE_AVAILABILITY');
  });

  it('rejects a slot crossing midnight', () => {
    expect(
      appointmentAvailabilityIssue(
        input({
          startTime: new Date(2026, 9, 28, 23, 30, 0),
          endTime: new Date(2026, 9, 29, 0, 30, 0),
        }),
      )?.code,
    ).toBe('OUTSIDE_AVAILABILITY');
  });

  it('accepts a different window on the same day', () => {
    expect(
      appointmentAvailabilityIssue(
        input({
          startTime: new Date(2026, 9, 28, 13, 0, 0),
          endTime: new Date(2026, 9, 28, 14, 0, 0),
          availability: [
            { dayOfWeek: 3, startTime: '09:00', endTime: '12:00', isAvailable: true },
            { dayOfWeek: 3, startTime: '13:00', endTime: '17:00', isAvailable: true },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('rejects an approved full-day time off', () => {
    expect(
      appointmentAvailabilityIssue(
        input({ timeOff: [{ date: new Date(2026, 9, 28), isApproved: true }] }),
      )?.code,
    ).toBe('TIME_OFF');
  });

  it('ignores unapproved time off', () => {
    expect(
      appointmentAvailabilityIssue(
        input({ timeOff: [{ date: new Date(2026, 9, 28), isApproved: false }] }),
      ),
    ).toBeNull();
  });

  it('only blocks the overlapping part of a partial time off', () => {
    const morningOff = {
      date: new Date(2026, 9, 28),
      startTime: new Date(2026, 9, 28, 9, 0, 0),
      endTime: new Date(2026, 9, 28, 10, 30, 0),
      isApproved: true,
    };

    expect(appointmentAvailabilityIssue(input({ timeOff: [morningOff] }))?.code).toBe('TIME_OFF');
    expect(
      appointmentAvailabilityIssue(
        input({
          startTime: new Date(2026, 9, 28, 11, 0, 0),
          endTime: new Date(2026, 9, 28, 12, 0, 0),
          timeOff: [morningOff],
        }),
      ),
    ).toBeNull();
  });

  it('rejects a blocked slot that overlaps the booking', () => {
    expect(
      appointmentAvailabilityIssue(
        input({
          blockedSlots: [
            {
              startTime: new Date(2026, 9, 28, 10, 30, 0),
              endTime: new Date(2026, 9, 28, 11, 30, 0),
            },
          ],
        }),
      )?.code,
    ).toBe('BLOCKED_SLOT');
  });

  it('ignores a blocked slot outside the booking', () => {
    expect(
      appointmentAvailabilityIssue(
        input({
          blockedSlots: [
            {
              startTime: new Date(2026, 9, 28, 14, 0, 0),
              endTime: new Date(2026, 9, 29, 15, 0, 0),
            },
          ],
        }),
      ),
    ).toBeNull();
  });
});
