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
 *
 * Chunking: next-auth splits the JWT into `<name>.0`, `<name>.1`, … when it
 * exceeds the cookie size limit. Those chunk names must be cleared too —
 * `request.cookies` is consulted for them.
 */

import type { NextResponse } from 'next/server';

/** Every session-cookie name next-auth may use (secure & legacy variants). */
export const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
] as const;

/**
 * next-auth splits a session JWT into `<base>.0`, `<base>.1`, … whenever it
 * exceeds the 4 KB cookie limit (the ERP token carries the permission list, so
 * it normally does). Those chunk cookies have *different names*, so clearing
 * only the base name leaves the real token in place and the denied request
 * loops exactly like the unprefixed-`Secure` bug described above.
 */
const SESSION_COOKIE_BASES = new Set<string>(SESSION_COOKIE_NAMES);

/** Cookie source the deny path hands us (NextRequest.cookies). */
interface RequestCookieSource {
  getAll(): { name: string; value: string }[];
}

/** `<base>` plus every `<base>.<n>` chunk actually present on the request. */
export function sessionCookieNamesToClear(
  requestCookies?: RequestCookieSource,
): string[] {
  const names = new Set<string>(SESSION_COOKIE_NAMES);
  for (const { name } of requestCookies?.getAll() ?? []) {
    const dot = name.lastIndexOf('.');
    if (dot === -1) continue;
    const base = name.slice(0, dot);
    const index = name.slice(dot + 1);
    if (SESSION_COOKIE_BASES.has(base) && /^\d+$/.test(index)) {
      names.add(name);
    }
  }
  return [...names];
}

/**
 * Expire every known session cookie with attributes browsers accept.
 *
 * `requestCookies` is optional but strongly recommended: it lets the helper
 * clear the exact chunked names the client presented.
 */
export function clearSessionCookies(
  response: NextResponse,
  requestCookies?: RequestCookieSource,
): void {
  const secure = process.env.NODE_ENV === 'production';
  for (const name of sessionCookieNamesToClear(requestCookies)) {
    response.cookies.delete({
      name,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }
}
