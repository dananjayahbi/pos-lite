import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decode } from 'next-auth/jwt';

// ── In-memory caches (Edge-compatible) ────────────────────────────────────
interface SessionVersionCacheEntry {
  sessionVersion: number;
  cachedAt: number;
}

const SESSION_VERSION_CACHE_TTL_MS = 5_000;
const sessionVersionCache = new Map<string, SessionVersionCacheEntry>();
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

// ── Helpers ────────────────────────────────────────────────────────────────

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStorePath(pathname: string): boolean {
  if (pathname.startsWith('/superadmin')) return false;
  if (pathname.startsWith('/api')) return false;
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

interface SessionUser {
  id: string;
  role: string;
  tenantId: string | null;
  sessionVersion: number;
}

/**
 * Reads and decodes the NextAuth JWT session token from cookies.
 * This replaces the NextAuth `auth()` middleware wrapper, which was crashing
 * on Vercel's Edge Runtime when called with `providers: []`.
 */
async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  // Try all possible cookie names (secure + non-secure, both naming conventions)
  let tokenValue: string | undefined;
  let cookieName: string | undefined;

  const secureToken = request.cookies.get('__Secure-authjs.session-token')?.value;
  if (secureToken) {
    tokenValue = secureToken;
    cookieName = '__Secure-authjs.session-token';
  }

  if (!tokenValue) {
    const nonSecureToken = request.cookies.get('authjs.session-token')?.value;
    if (nonSecureToken) {
      tokenValue = nonSecureToken;
      cookieName = 'authjs.session-token';
    }
  }

  if (!tokenValue) {
    const legacySecureToken = request.cookies.get('__Secure-next-auth.session-token')?.value;
    if (legacySecureToken) {
      tokenValue = legacySecureToken;
      cookieName = '__Secure-next-auth.session-token';
    }
  }

  if (!tokenValue) {
    const legacyToken = request.cookies.get('next-auth.session-token')?.value;
    if (legacyToken) {
      tokenValue = legacyToken;
      cookieName = 'next-auth.session-token';
    }
  }

  if (!tokenValue || !cookieName) return null;

  try {
    const token = await decode({ token: tokenValue, secret, salt: cookieName });
    if (!token) return null;

    const id = (token.id ?? token.sub) as string | undefined;
    if (!id) return null;

    return {
      id,
      role: (token.role as string) ?? 'UNKNOWN',
      tenantId: (token.tenantId as string | null) ?? null,
      sessionVersion: (token.sessionVersion as number) ?? 0,
    };
  } catch {
    return null;
  }
}

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

// ── Middleware handler ─────────────────────────────────────────────────────

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const user = await getSessionUser(request);
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

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

      // Fire-and-forget audit log
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

  // Tenant status enforcement
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

      if (user.role !== 'SUPER_ADMIN' && tenant?.status === 'SUSPENDED') {
        return NextResponse.redirect(new URL('/suspended', request.url));
      }
    }
  }

  // Subdomain-based tenant routing
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
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/internal/|.*\\..*).*)',
  ],
};
