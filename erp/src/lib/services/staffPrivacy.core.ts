/**
 * Staff directory privacy shaping (ARGUS #341).
 *
 * `GET /api/store/staff` used to select and return the full staff profile -
 * NIC, address, salary, allowances, bank account, ETF/EPF - to anyone holding
 * `staff:view`. The list only needs directory fields, so it now gets a minimal
 * DTO. The detail endpoint keeps HR/bank fields behind the stronger
 * `staff:manage` key and masks the account number when it is not needed.
 *
 * The helpers are pure so the allow-list can be tested without Prisma.
 */

/** Fields the staff table actually renders. */
export const STAFF_LIST_FIELDS = [
  'id',
  'email',
  'role',
  'isActive',
  'fullName',
  'contactNumber',
  'commissionRate',
  'clockedInAt',
  'createdAt',
] as const;

/** HR and payroll fields that require `staff:manage` on the detail endpoint. */
export const STAFF_SENSITIVE_FIELDS = [
  'nic',
  'address',
  'basicSalary',
  'allowances',
  'bankName',
  'bankBranch',
  'bankAccountNumber',
  'etfNumber',
  'epfNumber',
] as const;

/** Non-sensitive identity/access fields always returned by the detail endpoint. */
export const STAFF_DETAIL_BASE_FIELDS = [
  'id',
  'email',
  'role',
  'isActive',
  'permissions',
  'commissionRate',
  'clockedInAt',
  'lastLoginAt',
  'createdAt',
  'fullName',
  'contactNumber',
] as const;

export type StaffDtoValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | unknown[];

export type StaffDto = Record<string, StaffDtoValue>;

function pick(
  source: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) result[field] = source[field] ?? null;
  return result;
}

/**
 * Minimal list row. Sensitive fields are excluded by construction, even when a
 * caller passes a full Prisma user row.
 */
export function toStaffListDto(member: Record<string, unknown>): StaffDto {
  return pick(member, STAFF_LIST_FIELDS) as StaffDto;
}

/**
 * Mask an account number for display. Keeps at most the last four digits so a
 * payment can still be identified without exposing the full number.
 */
export function maskBankAccountNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '') return null;
  if (text.length <= 4) return '*'.repeat(text.length);
  return `****${text.slice(-4)}`;
}

export interface StaffDetailOptions {
  /** True only when the caller holds the stronger staff:manage permission. */
  includeSensitive: boolean;
}

/**
 * Detail DTO. Without `includeSensitive`, every HR/bank/statutory field is
 * nulled and the account number is returned masked instead of raw.
 */
export function toStaffDetailDto(
  member: Record<string, unknown>,
  options: StaffDetailOptions,
): StaffDto {
  const base = pick(member, STAFF_DETAIL_BASE_FIELDS) as StaffDto;
  base.permissions = Array.isArray(member.permissions)
    ? member.permissions.filter((permission): permission is string => typeof permission === 'string')
    : [];

  if (options.includeSensitive) {
    return {
      ...base,
      ...(pick(member, STAFF_SENSITIVE_FIELDS) as StaffDto),
    };
  }

  const restricted = pick(member, STAFF_SENSITIVE_FIELDS);
  for (const field of STAFF_SENSITIVE_FIELDS) restricted[field] = null;
  restricted.bankAccountNumber = maskBankAccountNumber(member.bankAccountNumber);

  return { ...base, ...(restricted as StaffDto) };
}
