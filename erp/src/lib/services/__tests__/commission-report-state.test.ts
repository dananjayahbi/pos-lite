import { describe, expect, it } from 'vitest';
import {
  parseCommissionApiEnvelope,
  resolveCommissionReportState,
} from '@/lib/services/commission-report-state';

describe('resolveCommissionReportState', () => {
  it('never shows zero/empty business data for a failed request', () => {
    expect(
      resolveCommissionReportState({ isLoading: false, isError: true, hasData: false }),
    ).toBe('error');
    expect(
      resolveCommissionReportState({ isLoading: false, isError: true, hasData: true }),
    ).toBe('error');
  });

  it('shows loading only before data', () => {
    expect(
      resolveCommissionReportState({ isLoading: true, isError: false, hasData: false }),
    ).toBe('loading');
    expect(
      resolveCommissionReportState({ isLoading: true, isError: false, hasData: true }),
    ).toBe('ready');
  });

  it('reserves empty for a successful empty response', () => {
    expect(
      resolveCommissionReportState({ isLoading: false, isError: false, hasData: false }),
    ).toBe('empty');
    expect(
      resolveCommissionReportState({ isLoading: false, isError: false, hasData: true }),
    ).toBe('ready');
  });
});

describe('parseCommissionApiEnvelope', () => {
  it('returns data from a successful envelope', () => {
    const parsed = parseCommissionApiEnvelope<{ unpaid: string }>(
      200,
      JSON.stringify({ success: true, data: { unpaid: '149.22' } }),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ unpaid: '149.22' });
  });

  it('keeps a well-formed API error message', () => {
    const parsed = parseCommissionApiEnvelope(
      403,
      JSON.stringify({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      }),
    );
    expect(parsed.success).toBe(false);
    expect(parsed.failure).toEqual({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  });

  it('turns an HTML/empty body into status copy, never parser text', () => {
    const html = parseCommissionApiEnvelope(502, '<html>Bad Gateway</html>');
    expect(html.failure?.message).toBe(
      'The commission service is unavailable. Try again in a moment.',
    );
    expect(html.failure?.message).not.toContain('Unexpected token');
    expect(parseCommissionApiEnvelope(404, '').failure?.message).toBe(
      'The commission report was not found.',
    );
  });

  it('treats a 200 error envelope as a failure', () => {
    const parsed = parseCommissionApiEnvelope(
      200,
      JSON.stringify({ success: false, error: { message: 'No tenant associated' } }),
    );
    expect(parsed.success).toBe(false);
    expect(parsed.failure?.message).toBe('No tenant associated');
  });
});
