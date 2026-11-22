import { describe, expect, it } from 'vitest';

import {
  isFixtureAppointment,
  isFixtureAppointmentTitle,
  isFixtureServiceName,
} from '@/lib/appointments/fixtures.core';

/** ARGUS #122: only obvious QA fixtures may be classified for cleanup. */
describe('appointment fixture classifier', () => {
  it('matches QA/test/F-series/module titles', () => {
    expect(isFixtureAppointmentTitle('QA walk-in')).toBe(true);
    expect(isFixtureAppointmentTitle('Test booking')).toBe(true);
    expect(isFixtureAppointmentTitle('F8done')).toBe(true);
    expect(isFixtureAppointmentTitle('Module 27 check')).toBe(true);
    expect(isFixtureAppointmentTitle('deleteMe please')).toBe(true);
  });

  it('matches the reported over-long fixture title', () => {
    expect(isFixtureAppointmentTitle('x'.repeat(200))).toBe(true);
  });

  it('does not match a real booking title', () => {
    expect(isFixtureAppointmentTitle('Ayurvedic consultation')).toBe(false);
    expect(isFixtureAppointmentTitle('Deep tissue massage')).toBe(false);
    expect(isFixtureAppointmentTitle('')).toBe(false);
    expect(isFixtureAppointmentTitle(null)).toBe(false);
  });

  it('classifies appointments by walk-in name too', () => {
    expect(
      isFixtureAppointment({ title: 'Consultation', walkInName: 'QA F8done' }),
    ).toBe(true);
    expect(
      isFixtureAppointment({ title: 'Consultation', walkInName: 'Nimal Perera' }),
    ).toBe(false);
  });

  it('matches DeleteMe / QA service names only', () => {
    expect(isFixtureServiceName('DeleteMe')).toBe(true);
    expect(isFixtureServiceName('QA service')).toBe(true);
    expect(isFixtureServiceName('Test service')).toBe(true);
    expect(isFixtureServiceName('Ayurvedic Consultation')).toBe(false);
  });
});
