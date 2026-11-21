/**
 * ARGUS #353 — failed API reads must not surface raw parser errors or zeroed
 * stats. These helpers are pure over the response text.
 */
import { describe, expect, it } from 'vitest';
import {
  describeApiFailure,
  envelopeErrorMessage,
  readJsonBody,
} from '@/lib/api/safe-response';

describe('readJsonBody', () => {
  it('parses a JSON envelope', async () => {
    const result = await readJsonBody<{ success: boolean }>({
      text: async () => '{"success":true}',
    });
    expect(result).toEqual({ ok: true, value: { success: true } });
  });

  it('tolerates an HTML error body', async () => {
    const result = await readJsonBody({
      text: async () => '<!DOCTYPE html><html><body>404</body></html>',
    });
    expect(result).toEqual({ ok: false, value: null });
  });

  it('tolerates an empty body', async () => {
    expect(await readJsonBody({ text: async () => '   ' })).toEqual({
      ok: false,
      value: null,
    });
  });

  it('tolerates a body that throws while reading', async () => {
    expect(
      await readJsonBody({
        text: async () => {
          throw new Error('stream closed');
        },
      }),
    ).toEqual({ ok: false, value: null });
  });
});

describe('envelopeErrorMessage', () => {
  it('reads and trims the envelope error message', () => {
    expect(
      envelopeErrorMessage({ error: { message: '  Insufficient permissions  ' } }),
    ).toBe('Insufficient permissions');
  });

  it('returns null for missing or non-string messages', () => {
    expect(envelopeErrorMessage(null)).toBeNull();
    expect(envelopeErrorMessage('<html>')).toBeNull();
    expect(envelopeErrorMessage({ error: { message: 42 } })).toBeNull();
    expect(envelopeErrorMessage({ error: { message: '   ' } })).toBeNull();
  });

  it('bounds an unusually long message', () => {
    const message = envelopeErrorMessage({ error: { message: 'x'.repeat(500) } });
    expect(message).not.toBeNull();
    expect(message!.length).toBe(200);
    expect(message).toMatch(/\.\.\.$/);
  });
});

describe('describeApiFailure', () => {
  it('prefers the API envelope message on a failed status', () => {
    expect(
      describeApiFailure({
        ok: false,
        status: 403,
        body: { error: { message: 'Insufficient permissions' } },
        fallback: 'Attendance could not be loaded',
      }),
    ).toBe('Attendance could not be loaded (Insufficient permissions)');
  });

  it('uses the fallback plus HTTP status for a non-JSON body', () => {
    const message = describeApiFailure({
      ok: false,
      status: 404,
      body: null,
      fallback: 'Attendance could not be loaded',
    });
    expect(message).toBe('Attendance could not be loaded (HTTP 404)');
    expect(message).not.toContain('<');
    expect(message).not.toContain('Unexpected token');
  });

  it('uses the fallback for an ok response with no envelope message', () => {
    expect(
      describeApiFailure({
        ok: true,
        status: 200,
        body: { success: false },
        fallback: 'Attendance could not be loaded',
      }),
    ).toBe('Attendance could not be loaded');
  });
});
