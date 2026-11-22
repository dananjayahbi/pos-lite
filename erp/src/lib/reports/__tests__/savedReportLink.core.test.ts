import { describe, expect, it } from 'vitest';

import {
  buildSavedReportHref,
  savedReportDownloadHref,
} from '@/lib/reports/savedReportLink.core';

/** ARGUS #450: UI navigation and download links for saved reports. */
describe('buildSavedReportHref', () => {
  it('composes an in-app href for a canonical slug with filters', () => {
    expect(
      buildSavedReportHref({
        reportType: 'sales',
        filters: { from: '2026-10-01', to: '2026-10-31' },
      }),
    ).toBe('/reports/sales?from=2026-10-01&to=2026-10-31');
  });

  it('repeats array filter values as separate query params', () => {
    expect(
      buildSavedReportHref({ reportType: 'sales-by-staff', filters: { staffId: ['u1', 'u2'] } }),
    ).toBe('/reports/sales-by-staff?staffId=u1&staffId=u2');
  });

  it('falls back to the canonical slug for legacy path rows', () => {
    expect(buildSavedReportHref({ reportType: '/reports/profit-loss', filters: null })).toBe(
      '/reports/profit-loss',
    );
  });

  it('returns null for unknown and protocol-relative legacy rows', () => {
    expect(buildSavedReportHref({ reportType: '//evil.com/x' })).toBeNull();
    expect(buildSavedReportHref({ reportType: 'not-a-report' })).toBeNull();
    expect(buildSavedReportHref({ reportType: '/reports/not-a-report' })).toBeNull();
  });
});

describe('savedReportDownloadHref', () => {
  it('builds download and inline view links for the artifact route', () => {
    expect(savedReportDownloadHref('cm123')).toBe('/api/reports/saved/cm123/download');
    expect(savedReportDownloadHref('cm123', true)).toBe(
      '/api/reports/saved/cm123/download?view=1',
    );
  });

  it('encodes hostile ids instead of injecting path segments', () => {
    expect(savedReportDownloadHref('../etc/passwd')).toBe(
      '/api/reports/saved/..%2Fetc%2Fpasswd/download',
    );
  });
});
