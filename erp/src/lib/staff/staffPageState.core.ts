/**
 * Staff page access and failure classification (ARGUS #344).
 *
 * `/staff` had no server gate, so a cashier saw "0 team members", the create
 * button/dialog and a blank table around a 403 API response. Any detail load
 * failure also rendered "Staff member not found", hiding real outages.
 *
 * These helpers keep the decisions pure and testable.
 */

export interface StaffPageAccessInput {
  authenticated: boolean;
  canViewStaff: boolean;
}

export type StaffPageAccess =
  | { kind: 'allow' }
  | { kind: 'redirect'; href: string };

export function resolveStaffPageAccess(input: StaffPageAccessInput): StaffPageAccess {
  if (!input.authenticated) return { kind: 'redirect', href: '/login' };
  if (!input.canViewStaff) return { kind: 'redirect', href: '/pos' };
  return { kind: 'allow' };
}

/** A staff API failure that still carries the HTTP status for UI decisions. */
export class StaffRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StaffRequestError';
    this.status = status;
  }
}

export type StaffDetailFailureKind = 'not-found' | 'forbidden' | 'load';

/** Only a real 404 is "not found"; 403/timeouts/5xx are load failures. */
export function classifyStaffDetailFailure(status: number): StaffDetailFailureKind {
  if (status === 404) return 'not-found';
  if (status === 401 || status === 403) return 'forbidden';
  return 'load';
}

export const STAFF_LIST_FALLBACK = 'Staff list could not be loaded';
export const STAFF_DETAIL_FALLBACK = 'Staff member could not be loaded';

export function staffDetailErrorTitle(kind: StaffDetailFailureKind): string {
  if (kind === 'not-found') return 'Staff member not found';
  if (kind === 'forbidden') return 'You cannot view this staff member';
  return 'Staff member could not be loaded';
}
