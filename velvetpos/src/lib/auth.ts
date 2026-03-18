import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { UserRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { AUTH_ACTIONS, createAuditLog, hashEmailForAudit } from '@/lib/services/audit.service';
import { getClientIp } from '@/lib/utils/request';
import {
  checkRateLimit,
  clearRateLimitBucket,
  recordFailedAttempt,
} from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const pinSchema = z.object({
  email: z.string().email('Invalid email address'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

function normalizePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions.filter((value): value is string => typeof value === 'string');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const ipAddress = getClientIp(request);
        const userAgent = request.headers.get('user-agent') ?? undefined;

        const rateLimit = checkRateLimit(ipAddress, 'login', 10, 15 * 60 * 1000);
        if (!rateLimit.allowed) {
          throw new CredentialsSignin('TOO_MANY_ATTEMPTS');
        }

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          recordFailedAttempt(ipAddress, 'login', 15 * 60 * 1000);
          throw new CredentialsSignin('CredentialsSignin');
        }
        const { email, password } = parsed.data;

        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
            permissions: true,
            tenantId: true,
            isActive: true,
            sessionVersion: true,
          },
        });

        if (!user) {
          recordFailedAttempt(ipAddress, 'login', 15 * 60 * 1000);
          await createAuditLog({
            tenantId: null,
            actorId: null,
            actorRole: 'UNKNOWN',
            entityType: 'User',
            entityId: hashEmailForAudit(email),
            action: AUTH_ACTIONS.LOGIN_FAILED_INVALID_CREDENTIALS,
            ipAddress,
            userAgent,
          });
          throw new CredentialsSignin('CredentialsSignin');
        }

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) {
          recordFailedAttempt(ipAddress, 'login', 15 * 60 * 1000);
          await createAuditLog({
            tenantId: user.tenantId,
            actorId: user.id,
            actorRole: user.role,
            entityType: 'User',
            entityId: user.id,
            action: AUTH_ACTIONS.LOGIN_FAILED_INVALID_CREDENTIALS,
            ipAddress,
            userAgent,
          });
          throw new CredentialsSignin('CredentialsSignin');
        }

        if (!user.isActive) {
          recordFailedAttempt(ipAddress, 'login', 15 * 60 * 1000);
          await createAuditLog({
            tenantId: user.tenantId,
            actorId: user.id,
            actorRole: user.role,
            entityType: 'User',
            entityId: user.id,
            action: AUTH_ACTIONS.LOGIN_FAILED_ACCOUNT_INACTIVE,
            ipAddress,
            userAgent,
          });
          throw new CredentialsSignin('ACCOUNT_INACTIVE');
        }

        clearRateLimitBucket(ipAddress, 'login');
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await createAuditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          actorRole: user.role,
          entityType: 'User',
          entityId: user.id,
          action: AUTH_ACTIONS.LOGIN_SUCCESS,
          ipAddress,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: normalizePermissions(user.permissions),
          tenantId: user.tenantId,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
    Credentials({
      id: 'pin',
      name: 'pin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials, request) {
        const ipAddress = getClientIp(request);
        const userAgent = request.headers.get('user-agent') ?? undefined;

        const rateLimit = checkRateLimit(ipAddress, 'pin', 10, 15 * 60 * 1000);
        if (!rateLimit.allowed) {
          throw new CredentialsSignin('TOO_MANY_ATTEMPTS');
        }

        const parsed = pinSchema.safeParse(credentials);
        if (!parsed.success) {
          recordFailedAttempt(ipAddress, 'pin', 15 * 60 * 1000);
          throw new CredentialsSignin('CredentialsSignin');
        }

        const { email, pin } = parsed.data;

        const user = await prisma.user.findFirst({
          where: {
            email,
            deletedAt: null,
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            role: true,
            permissions: true,
            tenantId: true,
            pin: true,
            sessionVersion: true,
          },
        });

        if (!user || !user.pin) {
          recordFailedAttempt(ipAddress, 'pin', 15 * 60 * 1000);
          await createAuditLog({
            tenantId: user?.tenantId ?? null,
            actorId: user?.id ?? null,
            actorRole: user?.role ?? 'UNKNOWN',
            entityType: 'User',
            entityId: user?.id ?? hashEmailForAudit(email),
            action: AUTH_ACTIONS.PIN_LOGIN_FAILED,
            ipAddress,
            userAgent,
          });
          throw new CredentialsSignin('CredentialsSignin');
        }

        const isPinValid = await bcrypt.compare(pin, user.pin);
        if (!isPinValid) {
          recordFailedAttempt(ipAddress, 'pin', 15 * 60 * 1000);
          await createAuditLog({
            tenantId: user.tenantId,
            actorId: user.id,
            actorRole: user.role,
            entityType: 'User',
            entityId: user.id,
            action: AUTH_ACTIONS.PIN_LOGIN_FAILED,
            ipAddress,
            userAgent,
          });
          throw new CredentialsSignin('CredentialsSignin');
        }

        clearRateLimitBucket(ipAddress, 'pin');
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await createAuditLog({
          tenantId: user.tenantId,
          actorId: user.id,
          actorRole: user.role,
          entityType: 'User',
          entityId: user.id,
          action: AUTH_ACTIONS.PIN_LOGIN_SUCCESS,
          ipAddress,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: normalizePermissions(user.permissions),
          tenantId: user.tenantId,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.permissions = (user as { permissions: string[] }).permissions;
        token.tenantId = (user as { tenantId: string | null }).tenantId;
        token.sessionVersion = (user as { sessionVersion: number }).sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
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
});
