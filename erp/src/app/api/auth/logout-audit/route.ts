import { auth } from '@/lib/auth';
import { ok, toErrorResponse } from '@/lib/api/error-envelope';
import { AUTH_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import { getClientIp } from '@/lib/utils/request';

/**
 * POST /api/auth/logout-audit — M01-04 (BUG-12).
 *
 * Writes the LOGOUT audit row for the current session. Called by client
 * sign-out handlers BEFORE signOut() clears the cookie, so `auth()` still
 * resolves the identity. Unauthenticated calls are a no-op 200 (the client
 * helper is best-effort; a 401 here would only produce noise).
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ok({ recorded: false });
    }

    await createAuditLog({
      tenantId: session.user.tenantId ?? null,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'User',
      entityId: session.user.id,
      action: AUTH_ACTIONS.LOGOUT,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return ok({ recorded: true });
  } catch (error) {
    return toErrorResponse(error, 'logout-audit');
  }
}
