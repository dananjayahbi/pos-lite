import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ARGUS #39 — regression guard for the pre-hydration login submit.
 *
 * The React behaviour is covered by the pure `login-params` tests; this static
 * assertion pins the one property that caused the leak: the <form> must be a
 * POST to the fallback route (a GET serialises email/password into the URL).
 */

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('login form markup', () => {
  const source = readSource('src/app/(auth)/login/login-form.tsx');
  const formTag = source.match(/<form[\s\S]*?>/)?.[0] ?? '';

  it('submits with method="post"', () => {
    expect(formTag).toContain('method="post"');
    expect(formTag.toLowerCase()).not.toContain('method="get"');
  });

  it('posts to the credential-discarding fallback route, not the page URL', () => {
    expect(formTag).toContain('action="/api/auth/login-fallback"');
  });

  it('keeps password inputs non-queryable and browser-managed', () => {
    expect(source).toContain('type="password"');
    expect(source).toContain('autoComplete="current-password"');
    expect(source).toContain('autoComplete="email"');
  });
});

describe('login no-JS fallback route', () => {
  const source = readSource('src/app/api/auth/login-fallback/route.ts');

  it('answers POST with a redirect to a clean login URL', () => {
    expect(source).toMatch(/export async function POST/);
    expect(source).toContain("'/login?js=1'");
  });

  it('never parses the submitted credential body', () => {
    expect(source).not.toContain('request.json');
    expect(source).not.toContain('formData');
  });
});

describe('login page sanitises leaked credentials', () => {
  const source = readSource('src/app/(auth)/login/page.tsx');

  it('strips credential params before rendering', () => {
    expect(source).toContain('hasLoginCredentials');
    expect(source).toContain('sanitizeLoginQuery');
  });
});
