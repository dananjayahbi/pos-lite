/**
 * My Account profile presentation (ARGUS #506).
 *
 * The card showed the mailbox alias even when a staff full name existed, and
 * formatted timestamps with the browser locale (US month-first, 12-hour) while
 * the rest of the ERP uses day-first, 24-hour text. These helpers pin the
 * convention so the card can be tested without rendering React.
 */
import { formatShortDateTime } from '@/lib/format';
import { staffDisplayName } from '@/lib/utils/staff-name';

export interface AccountProfileIdentity {
  email: string;
  fullName?: string | null;
}

/** Stored full name when present; otherwise the mailbox alias. */
export function resolveAccountDisplayName(profile: AccountProfileIdentity): string {
  const fullName = profile.fullName?.trim();
  return fullName && fullName.length > 0 ? fullName : staffDisplayName(profile.email);
}

/** `28 Oct 2026, 21:11`; `-` for a missing/unparseable value. */
export function formatAccountTimestamp(value?: string | Date | null): string {
  if (value === null || value === undefined) return '-';
  return formatShortDateTime(value);
}
