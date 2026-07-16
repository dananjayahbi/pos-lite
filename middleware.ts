import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import {
  getCachedSessionVersion,
  setCachedSessionVersion,
} from '@/lib/auth/session-version-cache';

export const runtime = 'nodejs';

const tenantSlugCache = new Map<string, boolean>();
const TENANT_DOMAIN_SUFFIX = '.velvetpos.com';
const RESERVED_SUBDOMAINS = new Set(['', 'www', 'app']);

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/pin-login',
  '/forgot-password',
  '/reset-password',
  '/api/auth/',
  '/api/webhooks/',
  '/status',
  '/api/health',
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
    pathname.includes('/billing') ||
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
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { sessionVersion: true },
      });

      if (dbUser) {
        dbSessionVersion = dbUser.sessionVersion;
        setCachedSessionVersion(userId, dbSessionVersion);
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

      await createAuditLog({
        tenantId: user.tenantId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'User',
        entityId: user.id,
        action: AUTH_ACTIONS.SESSION_INVALIDATED_BY_VERSION_MISMATCH,
        ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
        userAgent: request.headers.get('user-agent') ?? undefined,
      });

      return response;
    }
  }

  // Tenant status enforcement for store routes
  if (!user.tenantId || isSuspensionBypassPath(pathname)) {
    return NextResponse.next();
  }

  if (isStorePath(pathname)) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        graceEndsAt: true,
        subscriptionStatus: true,
      },
    });

    if (!tenant || tenant.deletedAt !== null) {
      return NextResponse.next();
    }

    // Subscription suspension — SUPER_ADMIN can bypass
    if (user.role !== 'SUPER_ADMIN') {
      if (tenant.subscriptionStatus === 'CANCELLED') {
        const suspendedUrl = new URL('/suspended', request.url);
        suspendedUrl.searchParams.set('reason', 'cancelled');
        return NextResponse.redirect(suspendedUrl);
      }

      if (
        tenant.subscriptionStatus === 'SUSPENDED' ||
        tenant.status === 'SUSPENDED'
      ) {
        return NextResponse.redirect(new URL('/suspended', request.url));
      }

      if (tenant.status === 'CANCELLED') {
        const suspendedUrl = new URL('/suspended', request.url);
        suspendedUrl.searchParams.set('reason', 'cancelled');
        return NextResponse.redirect(suspendedUrl);
      }
    }

    if (tenant.status === 'GRACE_PERIOD') {
      const response = NextResponse.next();
      response.headers.set('x-grace-period', 'true');
      if (tenant.graceEndsAt) {
        response.headers.set('x-grace-ends-at', tenant.graceEndsAt.toISOString());
      }
      return response;
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
        const tenant = await prisma.tenant.findFirst({
          where: { slug },
          select: { id: true },
        });
        exists = tenant !== null;
        tenantSlugCache.set(slug, exists);
      }

      if (exists) {
        requestHeaders.set('x-tenant-slug', slug);
        return NextResponse.next({ request: { headers: requestHeaders } });
      }

      if (process.env.NODE_ENV === 'production') {
        return NextResponse.redirect(
          new URL('https://velvetpos.com/not-found'),
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
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|.*\\..*).*)',
  ],
};
