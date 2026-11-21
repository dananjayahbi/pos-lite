/**
 * ARGUS #355 — attendance page access gate and clock-in visibility.
 */
import { describe, expect, it } from 'vitest';
import {
  isAttendancePath,
  resolveAttendancePageAccess,
  shouldShowClockWidget,
} from '@/lib/attendance/attendancePageAccess.core';

describe('resolveAttendancePageAccess', () => {
  it('sends an unauthenticated visitor to login', () => {
    expect(
      resolveAttendancePageAccess({ authenticated: false, canViewAttendance: false }),
    ).toEqual({ kind: 'redirect', href: '/login' });
  });

  it('sends a signed-in user without staff:attendance:view to the POS', () => {
    expect(
      resolveAttendancePageAccess({ authenticated: true, canViewAttendance: false }),
    ).toEqual({ kind: 'redirect', href: '/pos' });
  });

  it('allows a user with staff:attendance:view', () => {
    expect(
      resolveAttendancePageAccess({ authenticated: true, canViewAttendance: true }),
    ).toEqual({ kind: 'allow' });
  });
});

describe('isAttendancePath', () => {
  it('matches the attendance route and its children only', () => {
    expect(isAttendancePath('/staff/timeclock')).toBe(true);
    expect(isAttendancePath('/staff/timeclock/')).toBe(true);
    expect(isAttendancePath('/staff/timeclock/2026-11')).toBe(true);
    expect(isAttendancePath('/staff')).toBe(false);
    expect(isAttendancePath('/staff/timeclock-x')).toBe(false);
    expect(isAttendancePath('/pos')).toBe(false);
  });
});

describe('shouldShowClockWidget', () => {
  it('hides the clock-in on the attendance route without the permission', () => {
    expect(shouldShowClockWidget('/staff/timeclock', false)).toBe(false);
    expect(shouldShowClockWidget('/staff/timeclock/child', false)).toBe(false);
  });

  it('shows the clock-in on the attendance route with the permission', () => {
    expect(shouldShowClockWidget('/staff/timeclock', true)).toBe(true);
  });

  it('keeps self-service clocking on every other store page', () => {
    expect(shouldShowClockWidget('/pos', false)).toBe(true);
    expect(shouldShowClockWidget('/dashboard', false)).toBe(true);
    expect(shouldShowClockWidget('/staff', false)).toBe(true);
  });
});
