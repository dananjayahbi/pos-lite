import { describe, expect, it } from 'vitest';

import {
  hasLoginCredentials,
  safeCallbackUrl,
  sanitizeLoginQuery,
} from '@/lib/auth/login-params';

/** ARGUS #39 — credentials must never survive in the login URL. */
describe('sanitizeLoginQuery', () => {
  it('drops email/password from a leaked pre-hydration GET URL', () => {
    expect(
      sanitizeLoginQuery('email=cashier%40ayurpos.dev&password=secret123&callbackUrl=%2Fpos'),
    ).toBe('callbackUrl=%2Fpos');
  });

  it('keeps only the login parameters it understands', () => {
    expect(
      sanitizeLoginQuery(
        'sessionExpired=true&js=1&callbackUrl=%2Fsales&email=x&password=y&evil=1',
      ),
    ).toBe('callbackUrl=%2Fsales&sessionExpired=true&js=1');
  });

  it('accepts Next searchParams records (including arrays)', () => {
    expect(
      sanitizeLoginQuery({
        email: 'user@example.com',
        password: 'pw',
        callbackUrl: '/dashboard',
        sessionExpired: 'true',
      }),
    ).toBe('callbackUrl=%2Fdashboard&sessionExpired=true');
  });

  it('returns an empty string when only credentials are present', () => {
    expect(sanitizeLoginQuery('email=a&password=b')).toBe('');
  });
});

describe('hasLoginCredentials', () => {
  it('detects leaked credential params', () => {
    expect(hasLoginCredentials('email=a&password=b')).toBe(true);
    expect(hasLoginCredentials({ password: 'x' })).toBe(true);
    expect(hasLoginCredentials('callbackUrl=%2Fpos&sessionExpired=true')).toBe(false);
  });
});

describe('safeCallbackUrl', () => {
  it('accepts same-origin paths', () => {
    expect(safeCallbackUrl('/pos')).toBe('/pos');
    expect(safeCallbackUrl('/sales?page=2')).toBe('/sales?page=2');
  });

  it('rejects foreign, protocol-relative and API paths', () => {
    expect(safeCallbackUrl('https://evil.example/login')).toBeNull();
    expect(safeCallbackUrl('//evil.example')).toBeNull();
    expect(safeCallbackUrl('/api/store/sales')).toBeNull();
    expect(safeCallbackUrl(null)).toBeNull();
  });

  it('rejects callback URLs carrying credential params', () => {
    expect(safeCallbackUrl('/pos?password=secret')).toBeNull();
    expect(safeCallbackUrl('/pos?email=a@b.c')).toBeNull();
  });
});
