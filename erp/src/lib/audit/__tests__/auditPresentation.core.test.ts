import { describe, expect, it } from 'vitest';

import {
  auditChangeSummary,
  formatAuditActionLabel,
  formatAuditDateTime,
  formatAuditRoleLabel,
} from '@/lib/audit/auditPresentation.core';
import {
  AUDIT_PAGE_SIZES,
  DEFAULT_AUDIT_FILTERS,
  auditFiltersFromParams,
  auditFiltersToQuery,
  normalizeAuditPageSize,
} from '@/lib/audit/auditFilterState.core';

/** ARGUS #457: consistent labels, second-precision dates and change context. */
describe('formatAuditActionLabel', () => {
  it('renders the same title case in the table and the filter menu', () => {
    expect(formatAuditActionLabel('SALE_COMPLETED')).toBe('Sale Completed');
    expect(formatAuditActionLabel('PO_STATUS_CHANGED')).toBe('PO Status Changed');
    expect(formatAuditActionLabel('RAW_MATERIAL_STOCK_ADJUSTED')).toBe(
      'Raw Material Stock Adjusted',
    );
  });
});

describe('formatAuditRoleLabel', () => {
  it('humanizes roles and handles missing values', () => {
    expect(formatAuditRoleLabel('FACTORY_MANAGER')).toBe('Factory Manager');
    expect(formatAuditRoleLabel(null)).toBe('Unknown');
  });
});

describe('formatAuditDateTime', () => {
  it('includes seconds and a timezone', () => {
    const formatted = formatAuditDateTime('2026-11-22T10:04:33.000Z', 'UTC');
    expect(formatted).toContain('22 Nov 2026');
    expect(formatted).toContain('10:04:33');
    expect(formatted).toContain('UTC');
  });

  it('returns a dash for invalid values', () => {
    expect(formatAuditDateTime(null)).toBe('-');
    expect(formatAuditDateTime('not-a-date')).toBe('-');
  });
});

describe('auditChangeSummary', () => {
  it('summarizes changed fields only and collapses long diffs', () => {
    expect(
      auditChangeSummary({ amount: 10, status: 'OK' }, { amount: 12, status: 'OK' }),
    ).toBe('amount: 10 → 12');

    expect(
      auditChangeSummary(
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
      ),
    ).toBe('a: 1 → 4 · b: 2 → 5 · +1 more');
  });

  it('shows create and delete snapshots without arrows', () => {
    expect(auditChangeSummary(null, { name: 'New preset' })).toBe('name: New preset');
    expect(auditChangeSummary({ name: 'Old preset' }, null)).toBe('name: Old preset');
    expect(auditChangeSummary(null, null)).toBe('-');
  });
});

describe('audit filter URL state', () => {
  it('round-trips active filters and drops empty/ALL values', () => {
    const filters = {
      ...DEFAULT_AUDIT_FILTERS,
      entityType: 'Sale',
      action: 'SALE_COMPLETED',
      startDate: '2026-11-01',
      search: 'cm123',
    };
    const query = auditFiltersToQuery(filters, 3, 25);
    const parsed = new URLSearchParams(query);

    expect(parsed.get('entityType')).toBe('Sale');
    expect(parsed.get('action')).toBe('SALE_COMPLETED');
    expect(parsed.get('startDate')).toBe('2026-11-01');
    expect(parsed.get('endDate')).toBeNull();
    expect(parsed.get('userId')).toBeNull();
    expect(parsed.get('search')).toBe('cm123');
    expect(parsed.get('page')).toBe('3');
    expect(parsed.get('pageSize')).toBe('25');
  });

  it('hydrates defaults when the URL is empty and clamps search length', () => {
    expect(auditFiltersFromParams(new URLSearchParams())).toEqual(DEFAULT_AUDIT_FILTERS);

    const long = auditFiltersFromParams(
      new URLSearchParams({ search: 'x'.repeat(500), entityType: 'Sale' }),
    );
    expect(long.search).toHaveLength(200);
    expect(long.entityType).toBe('Sale');
  });

  it('only accepts the exposed page sizes', () => {
    expect(AUDIT_PAGE_SIZES).toEqual([25, 50, 100]);
    expect(normalizeAuditPageSize(25)).toBe(25);
    expect(normalizeAuditPageSize(1000)).toBe(50);
    expect(normalizeAuditPageSize(Number.NaN)).toBe(50);
  });
});
