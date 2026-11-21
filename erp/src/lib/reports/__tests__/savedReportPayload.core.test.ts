import { describe, expect, it } from 'vitest';

import { buildSavedReportRequest } from '@/lib/reports/savedReportPayload.core';

const base = {
  name: '  Monthly Sales  ',
  reportType: '/reports/sales',
  filters: { from: '2026-10-01', to: '2026-10-31' },
  format: 'pdf' as const,
  rows: [{ product: 'Tea', total: 100 }],
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'total', header: 'Total', width: 80 },
  ],
  title: 'Sales Report',
  dateRange: '2026-10-01 to 2026-10-31',
};

/** ARGUS #450: pin the exact payload the Save Report UI sends. */
describe('buildSavedReportRequest', () => {
  it('sends a canonical slug, trimmed name and the typed table snapshot', () => {
    const result = buildSavedReportRequest(base);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({
      name: 'Monthly Sales',
      reportType: 'sales',
      filters: base.filters,
      format: 'pdf',
      rows: base.rows,
      columns: [
        { key: 'product', header: 'Product' },
        { key: 'total', header: 'Total', width: 80 },
      ],
      title: 'Sales Report',
      dateRange: '2026-10-01 to 2026-10-31',
    });
    expect(JSON.stringify(result.payload)).not.toContain('/reports/sales');
  });

  it('rejects a path-like or protocol-relative report type at the UI boundary', () => {
    expect(buildSavedReportRequest({ ...base, reportType: '//evil.com/x' })).toMatchObject({
      ok: false,
      reason: 'invalid-report-type',
    });
    expect(buildSavedReportRequest({ ...base, reportType: 'not-a-report' })).toMatchObject({
      ok: false,
      reason: 'invalid-report-type',
    });
  });

  it('applies the shared name rule before the request is sent', () => {
    expect(buildSavedReportRequest({ ...base, name: '   ' })).toMatchObject({
      ok: false,
      reason: 'invalid-name',
    });
    expect(buildSavedReportRequest({ ...base, name: 'x'.repeat(101) })).toMatchObject({
      ok: false,
      reason: 'invalid-name',
    });
    expect(buildSavedReportRequest({ ...base, name: '<script>x</script>' })).toMatchObject({
      ok: false,
      reason: 'invalid-name',
    });
  });
});
