/**
 * Shared Auth Configuration (Edge-compatible)
 *
 * This file contains the auth configuration shared between:
 * - `auth.ts` (Node.js runtime — used by API routes with PrismaAdapter)
 * - Middleware (Edge Runtime — lightweight, no database adapter)
 *
 * IMPORTANT: Do NOT import any Node.js-specific modules or Prisma-generated
 * files here. Only import type-only from packages that support Edge Runtime.
 */
import type { NextAuthConfig } from 'next-auth';
import { headers } from 'next/headers';
import { resolveAuthRedirect } from '@/lib/auth/auth-redirect';

// Inlined Prisma enum — avoids importing @/generated/prisma/client which pulls
// in node:process/node:path/node:url and breaks the Edge Runtime bundler.
type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK' | 'DISPATCH_STAFF' | 'FACTORY_MANAGER';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' as const },
  pages: {
    signIn: '/login',
  },
  // M01-07 (BUG-54 cause 3): cookie-name determinism. In production HTTPS
  // NextAuth uses the __Secure- prefixed names; in dev it must NOT, even
  // behind an HTTPS-proxying setup that sets x-forwarded-proto — otherwise
  // the middleware/proxy derives one name while the app sets the other and
  // fresh sessions bounce straight back to /login.
  useSecureCookies: process.env.NODE_ENV === 'production',
  providers: [],
  callbacks: {
    /**
     * Dev-tunnel / reverse-proxy support. `SignOutButton` and the login form
     * pass an absolute `callbackUrl` built from `window.location.origin`, but
     * Auth.js compares it against a `baseUrl` derived from `request.url` —
     * which a tunnel makes `https://localhost:3003`. Without this callback the
     * user is redirected to that unreachable host. See
     * `@/lib/auth/auth-redirect` for the same-origin guard.
     */
    async redirect({ url, baseUrl }) {
      const requestHeaders = await headers();
      return resolveAuthRedirect(url, baseUrl, requestHeaders);
    },
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissions = user.permissions;
        token.tenantId = user.tenantId;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.permissions = token.permissions as string[];
        session.user.tenantId = token.tenantId as string | null;
        session.user.sessionVersion = token.sessionVersion as number;
      }
      return session;
    },
  },
};
