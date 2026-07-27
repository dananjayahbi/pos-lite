/**
 * Shared Auth Configuration (Edge-compatible)
 *
 * This file contains the auth configuration shared between:
 * - `auth.ts` (Node.js runtime — used by API routes with PrismaAdapter)
 * - Middleware (Edge Runtime — lightweight, no database adapter)
 *
 * IMPORTANT: Do NOT import any Node.js-specific modules (Prisma, bcrypt, crypto, etc.)
 * here. Only use `import type` for Prisma types (erased at compile time).
 */
import type { UserRole } from '@/generated/prisma/client';
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' as const },
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
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
