/**
 * Audit-log presentation and filter helpers (ARGUS #457).
 *
 * The table, modal and filter menu each formatted actions differently
 * (`SALE COMPLETED` vs `Sale Completed`), dates omitted seconds/timezone, and
 * the change context required opening a row. One set of pure helpers now drives
 * all three surfaces.
 */
import type { AuditLogFilterStateLike } from '@/lib/audit/auditFilterState.core';

/** Acronyms that stay uppercase in a humanized audit label. */
const LABEL_ACRONYMS = new Set([
  'API',
  'COD',
  'CSV',
  'ID',
  'IP',
  'OTP',
  'PDF',
  'PIN',
  'PO',
  'SKU',
  'SMS',
  'VAT',
  'XLSX',
]);

/** `SALE_COMPLETED` → `Sale Completed`. Shared by table, detail and filters. */
export function formatAuditActionLabel(action: string): string {
  return action
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (LABEL_ACRONYMS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** `FACTORY_MANAGER` → `Factory Manager`. */
export function formatAuditRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Unknown';
  return formatAuditActionLabel(role);
}

/**
 * Day-first timestamp with seconds and a timezone label, e.g.
 * `22 Nov 2026, 10:04:33 UTC`. Invalid values return `-`.
 */
export function formatAuditDateTime(
  value: string | Date | null | undefined,
  timeZone?: string,
): string {
  if (value === null || value === undefined) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
    ...(timeZone ? { timeZone } : {}),
  };
  return date.toLocaleString('en-GB', options);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Compact before/after summary for the row (detail stays in the modal):
 * `amount: 10 → 12 · status: OK → VOID`, or the snapshot fields for a
 * create/delete row. Long diffs collapse to `+N more`.
 */
export function auditChangeSummary(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  maxFields = 2,
): string {
  const beforeRecord = before ?? {};
  const afterRecord = after ?? {};
  const keys = Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])).sort();

  const parts: string[] = [];
  for (const key of keys) {
    const hasBefore = key in beforeRecord;
    const hasAfter = key in afterRecord;
    const beforeValue = displayValue(beforeRecord[key]);
    const afterValue = displayValue(afterRecord[key]);
    if (hasBefore && hasAfter) {
      if (beforeValue === afterValue) continue;
      parts.push(`${key}: ${beforeValue} → ${afterValue}`);
    } else if (hasAfter) {
      parts.push(`${key}: ${afterValue}`);
    } else {
      parts.push(`${key}: ${beforeValue}`);
    }
  }

  if (parts.length === 0) return '-';
  if (parts.length <= maxFields) return parts.join(' · ');
  return `${parts.slice(0, maxFields).join(' · ')} · +${parts.length - maxFields} more`;
}
