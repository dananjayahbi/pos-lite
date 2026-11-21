/**
 * Attendance page access decisions (ARGUS #355).
 *
 * `/staff/timeclock` is an all-staff attendance surface: the API requires
 * `staff:attendance:view`, but the page itself had no server gate. A cashier
 * therefore saw the Attendance heading, date picker, zeroed cards and an error
 * card after the API returned 403.
 *
 * The shared server guard (`requirePagePermission`) redirects to `/pos`, which
 * is the cashier's home. The same helper also hides the header clock-in while
 * an unauthorized user is on the attendance route (defense in depth if the
 * redirect is bypassed).
 */

export interface AttendancePageAccessInput {
  authenticated: boolean;
  canViewAttendance: boolean;
}

export type AttendancePageAccess =
  | { kind: 'allow' }
  | { kind: 'redirect'; href: string };

export function resolveAttendancePageAccess(
  input: AttendancePageAccessInput,
): AttendancePageAccess {
  if (!input.authenticated) return { kind: 'redirect', href: '/login' };
  if (!input.canViewAttendance) return { kind: 'redirect', href: '/pos' };
  return { kind: 'allow' };
}

/** The attendance route (and anything below it). */
export function isAttendancePath(pathname: string): boolean {
  return pathname === '/staff/timeclock' || pathname.startsWith('/staff/timeclock/');
}

/**
 * Keep the global self-service clock-in on normal store pages, but never show
 * it on the attendance surface to someone who cannot view attendance.
 */
export function shouldShowClockWidget(
  pathname: string,
  canViewAttendance: boolean,
): boolean {
  if (isAttendancePath(pathname)) return canViewAttendance;
  return true;
}
