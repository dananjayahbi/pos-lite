import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';
import { AUTH_ACTIONS, createAuditLog, hashEmailForAudit } from '@/lib/services/audit.service';
import { getClientIp } from '@/lib/utils/request';
import {
  checkRateLimit,
  clearRateLimitBucket,
  recordFailedAttempt,
} from '@/lib/rate-limit';
import { getEffectivePermissions } from '@/lib/constants/permissions';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
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
          permissions: getEffectivePermissions(user.role, user.permissions),
          tenantId: user.tenantId,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});
