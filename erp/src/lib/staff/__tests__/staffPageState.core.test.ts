/**
 * ARGUS #344 — staff page gate and failure classification.
 */
import { describe, expect, it } from 'vitest';
import {
  StaffRequestError,
  classifyStaffDetailFailure,
  resolveStaffPageAccess,
  staffDetailErrorTitle,
} from '@/lib/staff/staffPageState.core';

describe('resolveStaffPageAccess', () => {
  it('redirects an unauthenticated visitor to login', () => {
    expect(
      resolveStaffPageAccess({ authenticated: false, canViewStaff: false }),
    ).toEqual({ kind: 'redirect', href: '/login' });
  });

  it('redirects a signed-in user without staff:view to the POS', () => {
    expect(
      resolveStaffPageAccess({ authenticated: true, canViewStaff: false }),
    ).toEqual({ kind: 'redirect', href: '/pos' });
  });

  it('allows a user with staff:view', () => {
    expect(
      resolveStaffPageAccess({ authenticated: true, canViewStaff: true }),
    ).toEqual({ kind: 'allow' });
  });
});

describe('classifyStaffDetailFailure', () => {
  it('treats only a real 404 as not found', () => {
    expect(classifyStaffDetailFailure(404)).toBe('not-found');
  });

  it('treats auth failures as forbidden', () => {
    expect(classifyStaffDetailFailure(401)).toBe('forbidden');
    expect(classifyStaffDetailFailure(403)).toBe('forbidden');
  });

  it('treats every other status as a load error', () => {
    expect(classifyStaffDetailFailure(500)).toBe('load');
    expect(classifyStaffDetailFailure(502)).toBe('load');
    expect(classifyStaffDetailFailure(0)).toBe('load');
  });
});

describe('staffDetailErrorTitle', () => {
  it('uses distinct titles so a load failure is not called not-found', () => {
    const titles = new Set([
      staffDetailErrorTitle('not-found'),
      staffDetailErrorTitle('forbidden'),
      staffDetailErrorTitle('load'),
    ]);
    expect(titles.size).toBe(3);
    expect(staffDetailErrorTitle('not-found')).toBe('Staff member not found');
  });
});

describe('StaffRequestError', () => {
  it('carries the HTTP status for UI decisions', () => {
    const error = new StaffRequestError('Staff member could not be loaded', 500);
    expect(error.status).toBe(500);
    expect(error.message).toBe('Staff member could not be loaded');
  });
});
