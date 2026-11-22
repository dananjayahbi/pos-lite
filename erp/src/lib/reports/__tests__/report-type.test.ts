import { describe, expect, it } from 'vitest';

import {
  buildReportHref,
  normalizeReportType,
  REPORT_SLUGS,
} from '@/lib/reports/report-config';

/**
 * ARGUS #444 — the Save Report dialog posts a canonical slug, while the API
 * keeps rejecting route paths.
 */
describe('normalizeReportType', () => {
  it('strips the /reports/ prefix from a route path', () => {
    expect(normalizeReportType('/reports/profit-loss')).toBe('profit-loss');
    expect(normalizeReportType('/reports/sales')).toBe('sales');
    expect(normalizeReportType('/reports/inventory-valuation')).toBe('inventory-valuation');
    expect(normalizeReportType('/reports/saved')).toBe('saved');
  });

  it('accepts an already-canonical slug', () => {
    expect(normalizeReportType('profit-loss')).toBe('profit-loss');
    expect(normalizeReportType('sales-by-staff')).toBe('sales-by-staff');
  });

  it('tolerates trailing slashes, whitespace, query and hash', () => {
    expect(normalizeReportType(' /reports/sales/ ')).toBe('sales');
    expect(normalizeReportType('/reports/sales?from=2026-09-01')).toBe('sales');
    expect(normalizeReportType('/reports/sales#top')).toBe('sales');
    expect(normalizeReportType('reports/sales')).toBe('sales');
  });

  it('rejects unknown reports and non-report paths', () => {
    expect(normalizeReportType('/reports/not-a-report')).toBeNull();
    expect(normalizeReportType('not-a-report')).toBeNull();
    expect(normalizeReportType('/reports')).toBeNull();
    expect(normalizeReportType('/reports/')).toBeNull();
    expect(normalizeReportType('/dashboard')).toBeNull();
    expect(normalizeReportType('')).toBeNull();
    expect(normalizeReportType(null)).toBeNull();
    expect(normalizeReportType(undefined)).toBeNull();
  });

  it('rejects protocol-relative and nested values', () => {
    expect(normalizeReportType('//evil.com/x')).toBeNull();
    expect(normalizeReportType('/reports//evil.com')).toBeNull();
    expect(normalizeReportType('/reports/sales/extra')).toBeNull();
  });

  it('round-trips every known report slug', () => {
    for (const slug of REPORT_SLUGS) {
      expect(normalizeReportType(buildReportHref(slug))).toBe(slug);
      expect(normalizeReportType(slug)).toBe(slug);
    }
  });
});
