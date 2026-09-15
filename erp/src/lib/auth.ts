import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';
import {
  AUTH_ACTIONS,
  createAuditLog,
  hashEmailForAudit,
  writeAuditLog,
} from '@/lib/services/audit.service';
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

/**
 * Build a CredentialsSignin whose configurable `code` carries a specific
 * rejection token. The constructor argument only sets `.message`, which
 * next-auth does NOT surface to the client (the redirect carries `error=<type>`
 * and `code=<error.code>`); `signIn(...,{redirect:false})` therefore exposes
 * the token via `result.code`. Setting `code` here is the documented channel
 * ("`code` is configurable" - @auth/core CredentialsSignin). Tokens are
 * non-sensitive user-facing states (shown after password verification).
 */
function signinError(code: string): CredentialsSignin {
  const error = new CredentialsSignin(code);
  error.code = code;
  return error;
}

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
          throw signinError('TOO_MANY_ATTEMPTS');
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
          throw signinError('ACCOUNT_INACTIVE');
        }

        // M08-01 (BUG-35): tenant-level suspension gate. Checked ONLY after the
        // password verifies, so wrong-password attempts never learn that a
        // tenant is suspended (no oracle). Policy: SUSPENDED and CANCELLED block
        // login; GRACE_PERIOD and ACTIVE are allowed (grace-period banner UX is
        // a separate product decision — see M08-01 doc item 5). SUPER_ADMIN has
        // tenantId null and is unaffected.
        if (user.tenantId) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { status: true },
          });
          if (tenant && (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED')) {
            recordFailedAttempt(ipAddress, 'login', 15 * 60 * 1000);
            // SECURITY-relevant rejection: durable audit write (M03-02 pattern),
            // not the swallowing createAuditLog used by the other auth failures.
            await writeAuditLog({
              tenantId: user.tenantId,
              actorId: user.id,
              actorRole: user.role,
              entityType: 'User',
              entityId: user.id,
              action: AUTH_ACTIONS.LOGIN_FAILED_TENANT_SUSPENDED,
              ipAddress,
              userAgent,
            });
            throw signinError('TENANT_SUSPENDED');
          }
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
