/**
 * Session-cookie clearing — shared by the Edge proxy's deny paths.
 *
 * Extracted from `proxy.ts` so the contract is unit-testable. The deny flow
 * used to call `response.cookies.delete(name)` (string form), which emits a
 * `Set-Cookie` **without the `Secure` attribute**. In production next-auth
 * stores its session under the `__Secure-` prefix (`useSecureCookies`), and
 * per RFC 6265bis a user agent ignores any `Set-Cookie` whose name carries
 * that prefix unless `Secure` is present — so the "deletion" was silently
 * discarded, the session cookie survived, and a single denied request turned
 * into an infinite `/login` ⇄ `/dashboard` redirect loop in the browser.
 *
 * The object form passes the attributes explicitly. `secure` mirrors
 * `useSecureCookies` (production only — a `Secure` cookie set over plain HTTP
 * would be rejected in dev, where the session names carry no prefix).
 */

import type { NextResponse } from 'next/server';

/** Every session-cookie name next-auth may use (secure & legacy variants). */
export const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
] as const;

/** Expire every known session cookie with attributes browsers accept. */
export function clearSessionCookies(response: NextResponse): void {
  const secure = process.env.NODE_ENV === 'production';
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.delete({
      name,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }
}
