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

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/pin-login',
  '/forgot-password',
  '/reset-password',
  '/api/auth/',
  '/api/webhooks/',
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

  // Tenant status check placeholder for SubPhase 01.03:
  // - Query tenant by user.tenantId
  // - Redirect to /suspended for suspended tenants
  // - Add x-grace-period header for grace period tenants
  if (!user.tenantId) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|.*\\..*).*)',
  ],
};
