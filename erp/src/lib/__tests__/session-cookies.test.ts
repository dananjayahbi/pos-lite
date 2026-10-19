import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';

import { clearSessionCookies, SESSION_COOKIE_NAMES } from '@/lib/session-cookies';

/**
 * Regression pin for the production redirect loop (2026-10-07).
 *
 * `proxy.ts` denies a session and clears the cookie — but next-auth names the
 * production cookie `__Secure-authjs.session-token`, and browsers reject a
 * `__Secure-` Set-Cookie that lacks `Secure`. A deletion without the attribute
 * is discarded, the cookie survives, and `/login` ⇄ `/dashboard` loops forever.
 * These tests assert the attributes actually emitted on the wire, not the
 * helper's intent.
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/** TS declares NODE_ENV readonly; write through a mutable view (see internal-bridge-auth.test.ts). */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function setCookieHeaders(response: NextResponse): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const joined = headers.get('set-cookie');
  return joined ? [joined] : [];
}

beforeEach(() => {
  setNodeEnv('production');
});

afterEach(() => {
  if (ORIGINAL_NODE_ENV !== undefined) setNodeEnv(ORIGINAL_NODE_ENV);
});

describe('clearSessionCookies (production)', () => {
  it('emits one expiry Set-Cookie per known session-cookie name', () => {
    const headers = setCookieHeaders(clearSessionCookiesAndReturn());
    for (const name of SESSION_COOKIE_NAMES) {
      expect(
        headers.some((h) => h.startsWith(`${name}=`)),
        `missing expiry cookie for ${name}`,
      ).toBe(true);
    }
    expect(headers).toHaveLength(SESSION_COOKIE_NAMES.length);
  });

  it('marks every deletion Secure — without it browsers discard __Secure- deletions', () => {
    const headers = setCookieHeaders(clearSessionCookiesAndReturn());
    for (const header of headers) {
      expect(header, `${header} must carry Secure`).toMatch(/;\s*Secure(\s*;|$)/i);
    }
  });

  it('marks the __Secure- session cookie HttpOnly with a past expiry', () => {
    const headers = setCookieHeaders(clearSessionCookiesAndReturn());
    const secureSession = headers.find((h) =>
      h.startsWith('__Secure-authjs.session-token='),
    );
    expect(secureSession).toBeDefined();
    expect(secureSession).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(secureSession).toMatch(/;\s*HttpOnly(\s*;|$)/i);
    expect(secureSession).toMatch(/Path=\//i);
  });
});

describe('clearSessionCookies (development)', () => {
  it('omits Secure — dev runs over HTTP where a Secure cookie is rejected', () => {
    setNodeEnv('development');
    const headers = setCookieHeaders(clearSessionCookiesAndReturn());
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      expect(header, `${header} must not carry Secure in dev`).not.toMatch(
        /;\s*Secure(\s*;|$)/i,
      );
    }
  });
});

/** Build a redirect-shaped response and clear cookies on it, as `denySession` does. */
function clearSessionCookiesAndReturn(): NextResponse {
  const response = NextResponse.redirect(new URL('http://localhost/login'));
  clearSessionCookies(response);
  return response;
}
