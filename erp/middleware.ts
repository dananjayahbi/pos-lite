import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * Calls the internal middleware API to perform database operations that are
 * not available on the Edge Runtime.
 */
async function middlewareApi(
  request: NextRequest,
  body: Record<string, unknown>,
): Promise<Response> {
  const apiUrl = new URL('/api/internal/middleware', request.url);
  return fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const { auth } = NextAuth(authConfig);

// ── In-memory session-version cache (Edge-compatible) ─────────────────────
// Inlined from @/lib/auth/session-version-cache to avoid cross-module
// bundler issues on Vercel's Edge Runtime.
interface SessionVersionCacheEntry {
  sessionVersion: number;
  cachedAt: number;
}

const SESSION_VERSION_CACHE_TTL_MS = 5_000;
const sessionVersionCache = new Map<string, SessionVersionCacheEntry>();

function getCachedSessionVersion(userId: string): number | null {
  const cached = sessionVersionCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > SESSION_VERSION_CACHE_TTL_MS) {
    sessionVersionCache.delete(userId);
    return null;
  }
  return cached.sessionVersion;
}

function setCachedSessionVersion(userId: string, sessionVersion: number): void {
  sessionVersionCache.set(userId, { sessionVersion, cachedAt: Date.now() });
}

const tenantSlugCache = new Map<string, boolean>();
const TENANT_DOMAIN_SUFFIX = '.ayurpos.com';
const RESERVED_SUBDOMAINS = new Set(['', 'www', 'app']);

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/pin-login',
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

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStorePath(pathname: string): boolean {
  if (pathname.startsWith('/superadmin')) {
    return false;
  }

  if (pathname.startsWith('/api')) {
    return false;
  }

  return !isPublicPath(pathname);
}

function isSuspensionBypassPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
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

export default auth(async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = (request as unknown as { auth?: { user?: { id: string; role: string; tenantId: string | null; sessionVersion: number } } }).auth;
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user;

  if (pathname.startsWith('/superadmin') && user.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user.role === 'SUPER_ADMIN' && isStorePath(pathname)) {
    return NextResponse.redirect(new URL('/superadmin/dashboard', request.url));
  }

  const userId = user.id;
  const tokenSessionVersion = user.sessionVersion;

  if (userId) {
    let dbSessionVersion = getCachedSessionVersion(userId);

    if (dbSessionVersion === null) {
      const res = await middlewareApi(request, {
        action: 'checkSessionVersion',
        userId,
      });

      if (res.ok) {
        const data = await res.json();
        dbSessionVersion = data.sessionVersion;
        if (typeof dbSessionVersion === 'number') {
          setCachedSessionVersion(userId, dbSessionVersion);
        }
      }
    }

    if (
      typeof dbSessionVersion === 'number' &&
      typeof tokenSessionVersion === 'number' &&
      dbSessionVersion > tokenSessionVersion
    ) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('sessionExpired', 'true');

      const response = NextResponse.redirect(loginUrl);
      clearSessionCookies(response);

      // Fire-and-forget audit log (don't await — avoids blocking redirect)
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
      }).catch(() => {
        /* audit log failure is non-blocking */
      });

      return response;
    }
  }

  // Tenant status enforcement for store routes
  if (!user.tenantId || isSuspensionBypassPath(pathname)) {
    return NextResponse.next();
  }

  if (isStorePath(pathname)) {
    const res = await middlewareApi(request, {
      action: 'checkTenantStatus',
      tenantId: user.tenantId,
    });

    if (res.ok) {
      const tenant = await res.json();

      if (tenant && tenant.deletedAt !== null) {
        return NextResponse.next();
      }

      // Suspension check — SUPER_ADMIN can bypass
      if (user.role !== 'SUPER_ADMIN' && tenant?.status === 'SUSPENDED') {
        return NextResponse.redirect(new URL('/suspended', request.url));
      }
    }
  }

  // Subdomain-based tenant routing
  const hostHeader = request.headers.get('host');
  const hostname = hostHeader?.split(':')[0] ?? '';
  const requestHeaders = new Headers(request.headers);

  // Security: strip any incoming X-Tenant-Slug to prevent spoofing
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
    // Dev fallback: allow X-Tenant-Slug override via dev tools
    const devSlug = request.headers.get('x-tenant-slug');
    if (devSlug) {
      return NextResponse.next();
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/internal/|.*\\..*).*)',
  ],
};
