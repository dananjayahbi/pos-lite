import { describe, expect, it } from 'vitest';

import { resolveAuthRedirect } from '@/lib/auth/auth-redirect';

function headersOf(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null };
}

/**
 * Regression pins for the dev-tunnel sign-out bug (2026-10-30).
 *
 * Behind the tunnel, Auth.js derives `baseUrl` from `request.url` →
 * `https://localhost:3003`, while `SignOutButton` passes
 * `https://<tunnel>.use.devtunnels.ms/login`. The default callback rejected the
 * mismatch and sent the browser to `https://localhost:3003`, which the visitor
 * cannot reach.
 */
describe('resolveAuthRedirect', () => {
  const baseUrl = 'https://localhost:3003';
  const tunnel = headersOf({
    'x-forwarded-host': '1hnns666-3003.use.devtunnels.ms',
    'x-forwarded-proto': 'https',
  });

  it('accepts the forwarded public host the request actually arrived on', () => {
    expect(
      resolveAuthRedirect(
        'https://1hnns666-3003.use.devtunnels.ms/login',
        baseUrl,
        tunnel,
      ),
    ).toBe('https://1hnns666-3003.use.devtunnels.ms/login');
  });

  it('preserves query and hash of the forwarded URL', () => {
    expect(
      resolveAuthRedirect(
        'https://1hnns666-3003.use.devtunnels.ms/login?sessionExpired=true#top',
        baseUrl,
        tunnel,
      ),
    ).toBe('https://1hnns666-3003.use.devtunnels.ms/login?sessionExpired=true#top');
  });

  it('keeps root-relative callbackUrls on baseUrl (M01-05 behaviour)', () => {
    expect(resolveAuthRedirect('/dashboard', baseUrl, tunnel)).toBe(
      'https://localhost:3003/dashboard',
    );
  });

  it('accepts a same-origin absolute URL unchanged', () => {
    expect(resolveAuthRedirect('https://localhost:3003/pos', baseUrl, tunnel)).toBe(
      'https://localhost:3003/pos',
    );
  });

  it('rejects a foreign host — no open redirect', () => {
    expect(resolveAuthRedirect('https://evil.example/login', baseUrl, tunnel)).toBe(
      baseUrl,
    );
  });

  it('rejects a foreign host even when no proxy headers are present', () => {
    expect(
      resolveAuthRedirect('https://evil.example/login', baseUrl, headersOf({})),
    ).toBe(baseUrl);
  });

  it('rejects a scheme mismatch on the forwarded host', () => {
    expect(
      resolveAuthRedirect(
        'http://1hnns666-3003.use.devtunnels.ms/login',
        baseUrl,
        tunnel,
      ),
    ).toBe(baseUrl);
  });

  it('rejects protocol-relative URLs', () => {
    expect(resolveAuthRedirect('//evil.example/login', baseUrl, tunnel)).toBe(baseUrl);
  });

  it('tolerates multi-valued forwarded headers', () => {
    expect(
      resolveAuthRedirect(
        'https://1hnns666-3003.use.devtunnels.ms/login',
        baseUrl,
        headersOf({
          'x-forwarded-host': '1hnns666-3003.use.devtunnels.ms, internal.local',
          'x-forwarded-proto': 'https, http',
        }),
      ),
    ).toBe('https://1hnns666-3003.use.devtunnels.ms/login');
  });

  it('falls back to baseUrl for a malformed callbackUrl', () => {
    expect(resolveAuthRedirect('not a url', baseUrl, tunnel)).toBe(baseUrl);
  });
});
