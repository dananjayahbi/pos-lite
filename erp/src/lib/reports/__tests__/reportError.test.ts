import { describe, expect, it } from 'vitest';

import { resolveReportErrorMessage } from '@/lib/reports/reportError';

describe('resolveReportErrorMessage (ARGUS #442)', () => {
  it('prefers the typed server message for a 403 or 500', () => {
    expect(
      resolveReportErrorMessage(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      }),
    ).toBe('Insufficient permissions');

    expect(
      resolveReportErrorMessage(500, {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate report' },
      }),
    ).toBe('Failed to generate report');
  });

  it('falls back to an HTTP status line when the body is not JSON', () => {
    expect(resolveReportErrorMessage(502, null)).toBe(
      'Failed to fetch report (HTTP 502)',
    );
    expect(resolveReportErrorMessage(500, { success: false })).toBe(
      'Failed to fetch report (HTTP 500)',
    );
  });

  it('ignores an empty typed message', () => {
    expect(
      resolveReportErrorMessage(500, {
        error: { message: '   ' },
      }),
    ).toBe('Failed to fetch report (HTTP 500)');
  });
});
