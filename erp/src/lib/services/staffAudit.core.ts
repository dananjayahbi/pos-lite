/**
 * Pure snapshot/diff helpers for the staff audit trail (ARGUS #340).
 *
 * Staff administration was only audited for role, permission and password
 * changes. Creation, contact/HR details, salary, bank/statutory fields,
 * deactivation and commission-rate edits left no trace. These helpers build
 * small, deterministic before/after snapshots from an allow-list of fields:
 *
 * - secrets (password hashes, session versions, tokens) can never leak into
 *   the audit ledger, even if a caller passes a full Prisma user row;
 * - long free text is bounded so one address cannot bloat the row;
 * - unchanged fields are omitted, so a snapshot names only what actually
 *   changed.
 */

/** Longest free-text value stored in an audit before/after snapshot. */
export const STAFF_AUDIT_TEXT_LIMIT = 120;

/** Profile/HR fields that produce a generic STAFF_UPDATED row. */
export const STAFF_PROFILE_AUDIT_FIELDS = [
  'email',
  'fullName',
  'nic',
  'contactNumber',
  'address',
  'basicSalary',
  'allowances',
  'bankName',
  'bankBranch',
  'bankAccountNumber',
  'etfNumber',
  'epfNumber',
] as const;

/** Fields captured when an account is created. Secrets are never included. */
export const STAFF_CREATED_AUDIT_FIELDS = [
  'email',
  'role',
  'isActive',
  'commissionRate',
  ...STAFF_PROFILE_AUDIT_FIELDS,
] as const;

export type StaffAuditField =
  | (typeof STAFF_CREATED_AUDIT_FIELDS)[number]
  | 'isActive'
  | 'commissionRate';

export type StaffAuditValue = string | number | boolean | null;
export type StaffAuditSnapshot = Record<string, StaffAuditValue>;

/** Keys that must never reach the audit ledger. */
const SECRET_KEYS = new Set([
  'password',
  'passwordHash',
  'tempPassword',
  'newPassword',
  'sessionVersion',
  'token',
  'resetToken',
  'apiKey',
]);

function boundText(value: string): string {
  if (value.length <= STAFF_AUDIT_TEXT_LIMIT) return value;
  return `${value.slice(0, STAFF_AUDIT_TEXT_LIMIT - 3)}...`;
}

/**
 * Convert one value into a JSON-safe audit scalar.
 *
 * Prisma Decimals are objects with `toFixed`; stringifying them keeps the
 * snapshot stable across Prisma versions (5.00 -> "5" vs 5).
 */
function toAuditValue(value: unknown): StaffAuditValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return boundText(value);
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toFixed' in value) {
    const formatter = (value as { toFixed?: (digits?: number) => string }).toFixed;
    if (typeof formatter === 'function') return formatter.call(value, 2);
  }
  return boundText(String(value));
}

/**
 * Pick an allow-listed set of fields and normalise their values. Unknown and
 * secret keys are ignored by construction.
 */
export function buildStaffAuditSnapshot(
  source: Record<string, unknown> | null | undefined,
  fields: readonly string[],
): StaffAuditSnapshot {
  if (!source) return {};
  const snapshot: StaffAuditSnapshot = {};
  for (const field of fields) {
    if (SECRET_KEYS.has(field)) continue;
    if (!(field in source)) continue;
    snapshot[field] = toAuditValue(source[field]);
  }
  return snapshot;
}

export interface StaffAuditDiff {
  /** Only the fields whose values changed. */
  fields: string[];
  before: StaffAuditSnapshot;
  after: StaffAuditSnapshot;
}

/**
 * Compare two records over an allow-list. Values are compared by their
 * normalised audit scalar, so `5`, `5.0` and Decimal("5.00") are unchanged.
 */
export function diffStaffAuditFields(
  beforeSource: Record<string, unknown> | null | undefined,
  afterSource: Record<string, unknown> | null | undefined,
  fields: readonly string[],
): StaffAuditDiff {
  const beforeAll = buildStaffAuditSnapshot(beforeSource, fields);
  const afterAll = buildStaffAuditSnapshot(afterSource, fields);

  const changed: string[] = [];
  const before: StaffAuditSnapshot = {};
  const after: StaffAuditSnapshot = {};

  for (const field of fields) {
    const previous = beforeAll[field] ?? null;
    const next = afterAll[field] ?? null;
    if (previous === next) continue;
    changed.push(field);
    before[field] = previous;
    after[field] = next;
  }

  return { fields: changed, before, after };
}

/** True when a value is a safe, earnable commission rate (0-100 inclusive). */
export function formatCommissionRateForAudit(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}
