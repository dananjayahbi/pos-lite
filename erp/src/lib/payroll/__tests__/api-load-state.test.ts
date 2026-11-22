import { describe, expect, it } from 'vitest';
import {
  parsePayrollApiEnvelope,
  resolvePayrollLoadState,
} from '@/lib/payroll/api-load-state';

describe('resolvePayrollLoadState', () => {
  it('shows loading only until data arrives', () => {
    expect(
      resolvePayrollLoadState({ isLoading: true, isError: false, hasData: false }),
    ).toBe('loading');
    expect(
      resolvePayrollLoadState({ isLoading: true, isError: false, hasData: true }),
    ).toBe('ready');
  });

  it('never renders an empty state for a failed request', () => {
    expect(
      resolvePayrollLoadState({ isLoading: false, isError: true, hasData: false }),
    ).toBe('error');
    expect(
      resolvePayrollLoadState({ isLoading: false, isError: true, hasData: true }),
    ).toBe('error');
  });

  it('renders empty only after a successful response with no rows', () => {
    expect(
      resolvePayrollLoadState({ isLoading: false, isError: false, hasData: false }),
    ).toBe('empty');
    expect(
      resolvePayrollLoadState({ isLoading: false, isError: false, hasData: true }),
    ).toBe('ready');
  });
});

describe('parsePayrollApiEnvelope', () => {
  it('returns the data of a successful envelope', () => {
    const parsed = parsePayrollApiEnvelope<{ id: string }>(
      200,
      JSON.stringify({ success: true, data: { id: 'run_1' } }),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ id: 'run_1' });
  });

  it('keeps a well-formed API error message and code', () => {
    const parsed = parsePayrollApiEnvelope(
      404,
      JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Payroll run not found' },
      }),
    );
    expect(parsed.success).toBe(false);
    expect(parsed.failure).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Payroll run not found',
    });
  });

  it('turns an HTML error page into status copy, not a parser message', () => {
    const parsed = parsePayrollApiEnvelope(
      502,
      '<html><body><h1>Bad Gateway</h1></body></html>',
    );
    expect(parsed.success).toBe(false);
    expect(parsed.failure?.message).toBe(
      'The payroll service is unavailable. Try again in a moment.',
    );
    expect(parsed.failure?.message).not.toContain('Unexpected token');
  });

  it('handles an empty body', () => {
    expect(parsePayrollApiEnvelope(404, '').failure?.message).toBe(
      'The requested payroll record was not found.',
    );
    expect(parsePayrollApiEnvelope(500, null).failure?.message).toContain(
      'payroll service is unavailable',
    );
  });

  it('maps auth and permission statuses to actionable copy', () => {
    expect(parsePayrollApiEnvelope(401, '').failure?.message).toContain(
      'session has expired',
    );
    expect(parsePayrollApiEnvelope(403, '').failure?.message).toContain(
      'do not have permission',
    );
    expect(parsePayrollApiEnvelope(418, '').failure?.message).toBe(
      'The payroll request failed (HTTP 418).',
    );
  });

  it('does not treat a 200 error envelope as success', () => {
    const parsed = parsePayrollApiEnvelope(
      200,
      JSON.stringify({ success: false, error: { message: 'No tenant associated' } }),
    );
    expect(parsed.success).toBe(false);
    expect(parsed.failure?.message).toBe('No tenant associated');
  });
});
