/**
 * Proxy (Next 16 convention — formerly the root `middleware.ts`, M01-06).
 *
 * Runs on Edge Runtime before routes; the single database access point is the
 * /api/internal/middleware bridge (Node Runtime).
 *
 * ── Fail-closed policy (M01-06 / BUG-13 correction) ────────────────────────
 * Security gates in this file DENY on uncertainty:
 *  - sessionVersion: bridge non-OK, transport error, or a null answer for an
 *    existing session → terminate the session (401 JSON for /api/*,
 *    /login?sessionExpired=true for pages) instead of silently skipping the
 *    comparison. The old code skipped whenever the bridge hiccuped, which is
 *    why force-logout "did nothing" (BUG-5's real mechanism).
 *  - tenant suspension: bridge failure → deny (same shape, 403 JSON /
 *    /suspended redirect). The blanket `/api/` bypass is gone: every API
 *    namespace that serves tenant workspace data is suspension-checked;
 *    only the shared-infrastructure set is exempt (API_SHELL_EXEMPT_PREFIXES).
 *  - tenantless non-SUPER_ADMIN sessions cannot reach store pages or the
 *    tenant-workspace API at all (NEW-A — shared-account hardening; the
 *    DB-level half lands with M03-02).
 *  - the outer catch no longer fail-opens API traffic: pages pass through
 *    (render-level guards remain), /api/* answers a generic 500 envelope.
 *
 * ── sessionVersion cache invariant (M01-06 item 3) ─────────────────────────
 * CHOSEN STRATEGY: NO cache on the gate path. Every authenticated non-public
 * request consults the bridge, which does a fresh DB read. Invariant: a
 * sessionVersion bump (password reset, force-logout, deactivation-revoke) is
 * effective on the VERY NEXT request — zero staleness. The previous 5 s Edge
 * Map made tests/01 10.3 flaky (the post-bump request could hit a stale
 * entry); the Node-side session-version-cache.ts was never read by the
 * bridge, so it is deleted. If this funnel ever needs a cache, the TTL must
 * be ≤1 s AND force-logout must be documented as ≤TTL eventual — do not
 * reintroduce a 5 s window silently.
 */

// Edge Runtime polyfills — Vercel's Edge bootstrap may reference these
;(globalThis as Record<string, unknown>).__dirname ??= '/';
;(globalThis as Record<string, unknown>).__filename ??= '/proxy';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { buildBridgeAuthHeaders } from '@/lib/internal-bridge-headers';

// ── In-memory caches ───────────────────────────────────────────────────────
// Only the (harmless, additive) tenant-slug existence cache lives here; the
// sessionVersion gate is cache-free by design — see the header invariant.
const tenantSlugCache = new Map<string, boolean>();

const TENANT_DOMAIN_SUFFIX = '.ayurpos.com';
const RESERVED_SUBDOMAINS = new Set(['', 'www', 'app']);

// Areas the FACTORY_MANAGER role is explicitly denied (financials, CRM,
// sales orders, POS). Nav already hides these; this list enforces the
// restriction on direct-URL calls too.
const FACTORY_FORBIDDEN_PATH_PREFIXES = [
  '/pos',
  '/sales',
  '/returns',
  '/reports',
  '/customers',
  '/expenses',
  '/billing',
  '/staff',
  '/delivery/reconciliation',
];

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/auth/',
  '/api/webhooks/',
  '/api/public/',
  '/status',
  '/api/health',
  '/site',
  '/_next',
  '/fonts',
  '/icons',
  '/images',
];

// API namespaces that must stay reachable regardless of tenant suspension or
// session-funnel state (M01-06 item 4): auth flows, inbound webhooks, public
// endpoints, cron, the internal bridge itself, health, and the SUPER_ADMIN
// shell (its operator is intentionally tenantless). Everything else under
// /api/ is tenant-workspace data and IS gated.
const API_SHELL_EXEMPT_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/public/',
  '/api/cron/',
  '/api/internal/',
  '/api/health',
  '/api/superadmin/',
  '/api/test-error',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

// Tenant-workspace API paths: suspension + tenantless gates apply.
function isApiProtectedPath(pathname: string): boolean {
  return (
    isApiPath(pathname) &&
    !API_SHELL_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isStorePath(pathname: string): boolean {
  if (pathname.startsWith('/superadmin')) return false;
  if (pathname.startsWith('/api')) return false;
  return !isPublicPath(pathname);
}

function isSuspensionBypassPath(pathname: string): boolean {
  return (
    // M01-06 item 4: the blanket `/api/` bypass is replaced by the explicit
    // shared-infrastructure exemption set — store/tenant APIs ARE checked.
    (isApiPath(pathname) && !isApiProtectedPath(pathname)) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('/suspended') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest')
  );
}

function clearSessionCookies(response: NextResponse): void {
  response.cookies.delete('authjs.session-token');
  response.cookies.delete('__Secure-authjs.session-token');
  response.cookies.delete('next-auth.session-token');
  response.cookies.delete('__Secure-next-auth.session-token');
}

async function middlewareApi(
  request: NextRequest,
  body: Record<string, unknown>,
): Promise<Response> {
  const apiUrl = new URL('/api/internal/middleware', request.url);
  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // M35-02 hardening: present the shared bridge secret so the Node endpoint
      // can verify the caller. Empty when unconfigured, which makes the bridge
      // refuse the call in production (fail closed) instead of trusting it.
      ...buildBridgeAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
}

interface SessionUser {
  id: string;
  role: string;
  tenantId: string | null;
  sessionVersion: number;
}

async function getSessionUser(
  request: NextRequest,
): Promise<SessionUser | null> {
  try {
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    // M01-07 (cause 3): must mirror auth.config.ts's useSecureCookies exactly.
    // Dev always uses the unprefixed cookie name — never trust
    // x-forwarded-proto here, or an HTTPS-proxying dev setup makes the token
    // unreadable and every fresh session bounces back to /login.
    const secureCookie = process.env.NODE_ENV === 'production';

    const token = await getToken({
      req: request,
      secret,
      secureCookie,
    });

    if (!token) return null;

    const id = (token.id ?? token.sub) as string | undefined;
    if (!id) return null;

    return {
      id,
      role: (token.role as string) ?? 'UNKNOWN',
      tenantId: (token.tenantId as string | null) ?? null,
      sessionVersion: (token.sessionVersion as number) ?? 0,
    };
  } catch (err) {
    console.error('Proxy getSessionUser error:', err);
    return null;
  }
}

function apiDenied(_pathname: string, status: number, code: string, message: string): NextResponse {
  // API paths never render /suspended — answer the JSON envelope instead.
  return NextResponse.json(
    { success: false, error: { code, message, details: {} } },
    { status },
  );
}

// Terminate a session whose JWT is stale/invalid (or whose user vanished /
// the bridge failed): 401 JSON for APIs, /login?sessionExpired=true for pages.
function denySession(
  request: NextRequest,
  user: SessionUser,
  reason: 'version-mismatch' | 'user-not-found' | 'bridge-error',
): NextResponse {
  const pathname = request.nextUrl.pathname;

  if (reason === 'version-mismatch') {
    middlewareApi(request, {
      action: 'createAuditLog',
      tenantId: user.tenantId,
      actorId: user.id,
      actorRole: user.role,
      entityType: 'User',
      entityId: user.id,
      auditAction: 'SESSION_INVALIDATED_BY_VERSION_MISMATCH',
      ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {});
  }

  if (isApiPath(pathname)) {
    const response = apiDenied(
      pathname,
      401,
      'SESSION_INVALIDATED',
      'Your session has expired. Please sign in again.',
    );
    clearSessionCookies(response);
    return response;
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('sessionExpired', 'true');
  const response = NextResponse.redirect(loginUrl);
  clearSessionCookies(response);
  return response;
}

// Deny a tenantless non-SUPER_ADMIN session on store surfaces (NEW-A).
function denyTenantless(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  if (isApiPath(pathname)) {
    const response = apiDenied(
      pathname,
      401,
      'SESSION_INVALIDATED',
      'This account is not attached to a business. Sign in from a business account.',
    );
    clearSessionCookies(response);
    return response;
  }
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('sessionExpired', 'true');
  const response = NextResponse.redirect(loginUrl);
  clearSessionCookies(response);
  return response;
}

// Deny a suspended tenant (M01-06 item 4): 403 JSON for APIs, /suspended for pages.
function denyTenant(request: NextRequest, status: 'SUSPENDED' | 'unavailable'): NextResponse {
  const pathname = request.nextUrl.pathname;
  if (isApiPath(pathname)) {
    return apiDenied(
      pathname,
      403,
      status === 'SUSPENDED' ? 'TENANT_SUSPENDED' : 'TENANT_UNAVAILABLE',
      status === 'SUSPENDED'
        ? 'This business is suspended. Contact support.'
        : 'This business is currently unavailable.',
    );
  }
  return NextResponse.redirect(new URL('/suspended', request.url));
}

// ── Proxy handler ──────────────────────────────────────────────────────────

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  try {
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }

    const user = await getSessionUser(request);
    if (!user) {
      // Unauthenticated: pages bounce to /login; APIs fall through to their
      // route-level guards, which answer the 401 JSON envelope (specs
      // 04/05/06/08 S1 pins). A 307→/login for an API would surface 200 HTML.
      if (isApiPath(pathname)) {
        return NextResponse.next();
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname.startsWith('/superadmin') && user.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (user.role === 'SUPER_ADMIN' && isStorePath(pathname)) {
      return NextResponse.redirect(
        new URL('/superadmin/dashboard', request.url),
      );
    }

    // NEW-A (M01-06): a tenantless session that is not SUPER_ADMIN has no
    // legitimate store surface to touch. Block pages + tenant-workspace APIs.
    if (
      !user.tenantId &&
      user.role !== 'SUPER_ADMIN' &&
      (isStorePath(pathname) || isApiProtectedPath(pathname))
    ) {
      return denyTenantless(request);
    }

    if (
      user.role === 'FACTORY_MANAGER' &&
      !pathname.startsWith('/api') &&
      FACTORY_FORBIDDEN_PATH_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix),
      )
    ) {
      return NextResponse.redirect(new URL('/factory', request.url));
    }

    const userId = user.id;
    const tokenSessionVersion = user.sessionVersion;

    if (userId) {
      try {
        const res = await middlewareApi(request, {
          action: 'checkSessionVersion',
          userId,
        });
        if (!res.ok) {
          throw new Error(`bridge responded ${res.status}`);
        }
        const data = (await res.json()) as { sessionVersion?: number | null };
        if (typeof data.sessionVersion !== 'number') {
          // null for an existing session → user row deleted → deny (fail-closed).
          return denySession(request, user, 'user-not-found');
        }
        if (
          typeof tokenSessionVersion === 'number' &&
          data.sessionVersion > tokenSessionVersion
        ) {
          return denySession(request, user, 'version-mismatch');
        }
      } catch (err) {
        console.error('Proxy sessionVersion bridge failed — denying (fail-closed):', err);
        return denySession(request, user, 'bridge-error');
      }
    }

    if (!user.tenantId || isSuspensionBypassPath(pathname)) {
      return NextResponse.next();
    }

    if (isStorePath(pathname) || isApiProtectedPath(pathname)) {
      try {
        const res = await middlewareApi(request, {
          action: 'checkTenantStatus',
          tenantId: user.tenantId,
        });
        if (!res.ok) {
          throw new Error(`bridge responded ${res.status}`);
        }
        const tenant = (await res.json()) as {
          status?: string | null;
          deletedAt?: string | null;
        } | null;
        // NEW-B: the bridge answers 200 {status:null} (or a null body for a
        // missing row) — an explicit "no tenant" answer denies (fail-closed).
        if (tenant === null || tenant.status === null || tenant.status === undefined) {
          return denyTenant(request, 'unavailable');
        }
        // Deleted tenants are unusable (M01-06 fail-closed); suspended tenants
        // are blocked for everyone except SUPER_ADMIN (who is not tenant-scoped).
        if (tenant.deletedAt != null) {
          return denyTenant(request, 'unavailable');
        }
        if (user.role !== 'SUPER_ADMIN' && tenant.status === 'SUSPENDED') {
          return denyTenant(request, 'SUSPENDED');
        }
      } catch (err) {
        console.error('Proxy tenant-status bridge failed — denying (fail-closed):', err);
        return denyTenant(request, 'unavailable');
      }
    }

    const hostHeader = request.headers.get('host');
    const hostname = hostHeader?.split(':')[0] ?? '';
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('x-tenant-slug');

    if (hostname.endsWith(TENANT_DOMAIN_SUFFIX)) {
      const slug = hostname.slice(0, -TENANT_DOMAIN_SUFFIX.length);

      if (!RESERVED_SUBDOMAINS.has(slug)) {
        let exists = tenantSlugCache.get(slug);

        if (exists === undefined) {
          const res = await middlewareApi(request, {
            action: 'checkTenantSlug',
            slug,
          });

          if (res.ok) {
            const data = await res.json();
            exists = data.exists === true;
            tenantSlugCache.set(slug, exists);
          } else {
            exists = false;
          }
        }

        if (exists) {
          requestHeaders.set('x-tenant-slug', slug);
          return NextResponse.next({ request: { headers: requestHeaders } });
        }

        if (process.env.NODE_ENV === 'production') {
          return NextResponse.redirect(
            new URL('https://ayurpos.com/not-found'),
          );
        }
      }
    } else if (process.env.NODE_ENV !== 'production') {
      const devSlug = request.headers.get('x-tenant-slug');
      if (devSlug) {
        return NextResponse.next();
      }
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    // Fail-closed for APIs (generic 500 envelope); pages fall through to
    // render-level guards, which re-check auth server-side (M01-06).
    console.error('Proxy error:', err);
    if (isApiPath(pathname)) {
      return apiDenied(
        pathname,
        500,
        'INTERNAL_ERROR',
        'Request could not be completed.',
      );
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/internal/|.*\\..*).*)',
  ],
};
