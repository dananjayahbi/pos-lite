// Edge Runtime polyfills — Vercel's Edge bootstrap may reference these
;(globalThis as Record<string, unknown>).__dirname ??= '/';
;(globalThis as Record<string, unknown>).__filename ??= '/middleware';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ── In-memory caches ───────────────────────────────────────────────────────

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

    const token = await getToken({
      req: request,
      secret,
      secureCookie:
        request.url.startsWith('https://') ||
        !!request.headers.get('x-forwarded-proto')?.includes('https'),
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
    console.error('Middleware getSessionUser error:', err);
    return null;
  }
}

// ── Middleware handler ─────────────────────────────────────────────────────

export default async function middleware(request: NextRequest) {
  try {
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
      return NextResponse.redirect(
        new URL('/superadmin/dashboard', request.url),
      );
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

        return response;
      }
    }

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
    console.error('Middleware error:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/internal/|.*\\..*).*)',
  ],
};
