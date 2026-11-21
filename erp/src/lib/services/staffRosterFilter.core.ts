/**
 * Staff roster filtering and paging (ARGUS #465).
 *
 * The Team & Permissions roster showed only a display name derived from the
 * mailbox local part, so two people sharing a local part were indistinguishable
 * and there was no way to search at scale. The page now shows the stored email
 * and filters on name/email/role/status. The list endpoint returns one tenant's
 * staff, so filtering is local and pure (and therefore testable).
 */

export interface StaffRosterFilterInput {
  search?: string | undefined;
  role?: string | undefined;
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' | string | undefined;
}

export interface StaffRosterMember {
  email: string;
  fullName?: string | null;
  role: string;
  isActive: boolean;
}

/** Display alias for a member: stored full name, falling back to the mailbox. */
export function rosterDisplayName(member: Pick<StaffRosterMember, 'email' | 'fullName'>): string {
  const name = member.fullName?.trim();
  if (name) return name;
  const localPart = member.email.split('@')[0] ?? member.email;
  return localPart.replace(/[._-]+/g, ' ').trim() || member.email;
}

/**
 * Filter by a case-insensitive search across the email, full name and derived
 * display name, plus exact role and active-status filters. `ALL` means no
 * filter for that dimension.
 */
export function filterStaffRoster<T extends StaffRosterMember>(
  members: readonly T[],
  input: StaffRosterFilterInput = {},
): T[] {
  const query = (input.search ?? '').trim().toLowerCase();
  const role = input.role && input.role !== 'ALL' ? input.role : null;
  const status = input.status && input.status !== 'ALL' ? input.status : null;

  return members.filter((member) => {
    if (role !== null && member.role !== role) return false;
    if (status === 'ACTIVE' && !member.isActive) return false;
    if (status === 'INACTIVE' && member.isActive) return false;
    if (query === '') return true;
    return (
      member.email.toLowerCase().includes(query) ||
      (member.fullName ?? '').toLowerCase().includes(query) ||
      rosterDisplayName(member).toLowerCase().includes(query)
    );
  });
}

export interface StaffRosterPage<T> {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
}

/** Slice a filtered roster into pages; an out-of-range page clamps to the end. */
export function paginateStaffRoster<T>(
  members: readonly T[],
  page: number,
  pageSize: number,
): StaffRosterPage<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(members.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return {
    rows: members.slice((current - 1) * size, current * size),
    page: current,
    pageCount,
    total: members.length,
  };
}
