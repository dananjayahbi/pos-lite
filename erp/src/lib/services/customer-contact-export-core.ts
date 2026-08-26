/**
 * Customer Contact Export — Core logic (pure, Prisma-free).
 *
 * Holds the export contract, scope filtering, opt-out/exclusion rules,
 * phone deduplication, and file renderers (CSV / XLSX). Kept separate from the
 * Prisma-backed service so the rules are unit-testable without a database and
 * the render format can change without touching the query layer.
 */
import * as XLSX from 'xlsx';

// ── Export contract ──────────────────────────────────────────────────────────

/** Scope of customers included in an export run. */
export type ContactExportScope = 'ALL' | 'ACTIVE' | 'NEW' | 'REPEAT';

/** Output file format. */
export type ContactExportFormat = 'csv' | 'xlsx';

/** Tag a customer carries to signal they must be excluded from contact outreach. */
export const CONTACT_OPT_OUT_TAG = 'no-contact';

/** Minimum order count for the REPEAT scope (aligned with doc 20). */
export const REPEAT_EXPORT_THRESHOLD = 2;

/** Default recency window (days) for ACTIVE / NEW scopes. */
export const DEFAULT_ACTIVE_DAYS = 90;

/**
 * Raw customer row shape used by the query layer before filtering/dedup.
 * `totalSpend` is a Decimal to avoid precision loss until rendering.
 */
export interface ContactCandidate {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  totalSpend: { toNumber(): number };
  lastPurchaseAt: Date | null;
  orderCount: number;
  tenantName: string | null;
}

/** A single exported contact row (flat, serialisable). */
export interface ContactRow {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  lastPurchaseAt: string | null;
  orderCount: number;
  totalSpend: number;
  preferredStore: string | null;
}

export interface ScopeFilterOptions {
  scope: ContactExportScope;
  /** Recency window in days for ACTIVE / NEW. Defaults to DEFAULT_ACTIVE_DAYS. */
  activeDays?: number | undefined;
  /** Reference time for recency. Defaults to now. */
  now?: Date | undefined;
}

// ── Phone normalisation / dedup ──────────────────────────────────────────────

/**
 * Normalise a Sri Lankan phone number to E.164 `94xxxxxxxxx`. Returns null when
 * the number is not a recognisable 10-digit local or 11-digit 94-prefixed form.
 */
export function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '94' + digits.slice(1);
  }
  if (digits.startsWith('94') && digits.length === 11) {
    return digits;
  }
  return null;
}

// ── Exclusion / opt-out rules ────────────────────────────────────────────────

/**
 * A customer is excluded from outreach when they are inactive, soft-deleted, or
 * carry the opt-out tag. Excluded candidates never appear in an export.
 */
export function isContactExcluded(candidate: ContactCandidate): boolean {
  if (!candidate.isActive) return true;
  if (candidate.deletedAt !== null) return true;
  return candidate.tags.some((tag) => tag.toLowerCase() === CONTACT_OPT_OUT_TAG);
}

// ── Scope filtering ──────────────────────────────────────────────────────────

/** Decide whether a candidate matches the requested export scope. */
export function matchesContactScope(
  candidate: ContactCandidate,
  options: ScopeFilterOptions,
): boolean {
  const activeDays = options.activeDays ?? DEFAULT_ACTIVE_DAYS;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - activeDays * 24 * 60 * 60 * 1000);

  switch (options.scope) {
    case 'ALL':
      return true;
    case 'ACTIVE':
      return (
        candidate.lastPurchaseAt !== null &&
        candidate.lastPurchaseAt !== undefined &&
        candidate.lastPurchaseAt >= cutoff
      );
    case 'NEW':
      return candidate.createdAt >= cutoff;
    case 'REPEAT':
      return candidate.orderCount >= REPEAT_EXPORT_THRESHOLD;
    default:
      return true;
  }
}

/**
 * Apply exclusion + scope rules and deduplicate by normalised phone.
 * When two rows share a phone, the one carrying an email is preferred.
 * Rows without a recognisable phone are still included (keyed by id) so no
 * contact is silently dropped, but duplicate phones are collapsed.
 */
export function buildContactRows(
  candidates: ContactCandidate[],
  options: ScopeFilterOptions,
): { rows: ContactRow[]; included: number; excluded: number } {
  let excluded = 0;

  const byKey = new Map<string, ContactRow>();

  for (const candidate of candidates) {
    if (isContactExcluded(candidate)) {
      excluded++;
      continue;
    }
    if (!matchesContactScope(candidate, options)) {
      excluded++;
      continue;
    }

    const row: ContactRow = {
      customerId: candidate.id,
      name: candidate.name,
      phone: candidate.phone,
      email: candidate.email,
      lastPurchaseAt:
        candidate.lastPurchaseAt === null
          ? null
          : candidate.lastPurchaseAt.toISOString(),
      orderCount: candidate.orderCount,
      totalSpend: candidate.totalSpend.toNumber(),
      preferredStore: candidate.tenantName,
    };

    const key = normalizePhoneNumber(candidate.phone) ?? candidate.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
    } else if (existing.email === null && row.email !== null) {
      // Prefer the row that has an email for dedup purposes.
      byKey.set(key, row);
    }
  }

  return { rows: [...byKey.values()], included: byKey.size, excluded };
}

// ── Rendering ────────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'customerId',
  'name',
  'phone',
  'email',
  'lastPurchaseAt',
  'orderCount',
  'totalSpend',
  'preferredStore',
] as const;

function toRecord(row: ContactRow): Record<string, string | number | null> {
  return {
    customerId: row.customerId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    lastPurchaseAt: row.lastPurchaseAt,
    orderCount: row.orderCount,
    totalSpend: Number.isFinite(row.totalSpend) ? Number(row.totalSpend.toFixed(2)) : 0,
    preferredStore: row.preferredStore,
  };
}

function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Render rows as CSV text (UTF-8 BOM for Excel compatibility). */
export function renderContactsCSV(rows: ContactRow[]): string {
  const header = EXPORT_HEADERS.map(escapeCSV).join(',');
  const body = rows.map((row) =>
    EXPORT_HEADERS.map((key) => escapeCSV(toRecord(row)[key] ?? null)).join(','),
  );
  return '\uFEFF' + [header, ...body].join('\r\n');
}

/** Render rows as an .xlsx Buffer using the `xlsx` library. */
export function renderContactsXLSX(rows: ContactRow[]): Buffer {
  const data = rows.map(toRecord);
  const sheet = XLSX.utils.json_to_sheet(data, { header: [...EXPORT_HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contacts');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Produce a timestamped filename for an export, e.g. `contacts-20260807-101530.csv`. */
export function buildExportFilename(
  format: ContactExportFormat,
  now: Date = new Date(),
): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `contacts-${stamp}.${format}`;
}
