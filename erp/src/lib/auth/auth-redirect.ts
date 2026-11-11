/**
 * Auth.js `redirect` callback.
 *
 * Purpose: make `signIn()` / `signOut()` work when the browser reaches the app
 * through a reverse proxy or dev tunnel.
 *
 * `SignOutButton` passes an absolute `callbackUrl` built from
 * `window.location.origin` (correct by construction — it is literally the
 * origin the user is on). Auth.js compares that URL against its `baseUrl`,
 * which comes from `request.url`. Next builds `request.url` from the forwarded
 * `Host: localhost:3003` plus `x-forwarded-proto: https`, so `baseUrl` becomes
 * `https://localhost:3003` while the browser is on
 * `https://<tunnel>.use.devtunnels.ms`. The origins differ, the absolute URL is
 * rejected, and the user lands on `https://localhost:3003` — unreachable.
 *
 * Security (keeps M01-05's same-origin contract, no open redirect):
 *  - root-relative paths are resolved against `baseUrl` (unchanged behaviour);
 *  - an absolute URL is accepted only when its host matches the forwarded host
 *    of the very request being handled — the request's own public host, so the
 *    target is by definition same-site;
 *  - everything else falls back to `baseUrl`.
 */

/** Only what the callback needs from the incoming request's headers. */
export interface ForwardedOriginHeaders {
  get(name: string): string | null;
}

function firstHeaderValue(
  headers: ForwardedOriginHeaders,
  name: string,
): string | undefined {
  const raw = headers.get(name);
  if (!raw) return undefined;
  const [first] = raw.split(',');
  return first?.trim() || undefined;
}

/**
 * Same-origin guard for Auth.js redirects.
 *
 * @param url      the `callbackUrl` Auth.js proposes
 * @param baseUrl  Auth.js's base URL (derived from `request.url`)
 * @param headers  headers of the request being handled
 */
export function resolveAuthRedirect(
  url: string,
  baseUrl: string,
  headers: ForwardedOriginHeaders,
): string {
  if (url.startsWith('/')) {
    // Protocol-relative (`//host/path`) is treated as external, matching the
    // login form's `safeCallbackUrl` guard.
    if (url.startsWith('//')) return baseUrl;
    return `${baseUrl}${url}`;
  }

  let target: URL;
  let base: URL;
  try {
    target = new URL(url);
    base = new URL(baseUrl);
  } catch {
    return baseUrl;
  }

  if (target.origin === base.origin) return url;

  const forwardedHost = firstHeaderValue(headers, 'x-forwarded-host');
  const forwardedProto = firstHeaderValue(headers, 'x-forwarded-proto') ?? base.protocol.replace(':', '');
  if (!forwardedHost) return baseUrl;

  if (target.host !== forwardedHost) return baseUrl;
  if (target.protocol !== `${forwardedProto}:`) return baseUrl;

  return `${target.origin}${target.pathname}${target.search}${target.hash}`;
}
