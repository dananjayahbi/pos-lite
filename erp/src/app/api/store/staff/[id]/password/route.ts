import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { setStaffPassword } from '@/lib/services/staff.service';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { getClientIp } from '@/lib/utils/request';

/**
 * POST /api/store/staff/[id]/password — M03-08 (GAP-2).
 *
 * Admin (OWNER / manageStaff) set-password for a staff member. Closes the
 * "a newly created account cannot sign in" hole: createStaffMember hashes a
 * random UUID that is never surfaced, so this is the guaranteed path to give
 * an account a usable password. Bumps sessionVersion (NEW-D) so the subject's
 * live sessions die, and writes a durable STAFF_PASSWORD_SET audit row with
 * the real actor (M03-02).
 */

const passwordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    if (!hasPermission(session.user, PERMISSIONS.STAFF.manageStaff)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = passwordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const { id } = await params;
    const updated = await setStaffPassword(tenantId, id, parsed.data.newPassword, {
      id: session.user.id,
      role: session.user.role,
      tenantId,
    }, {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return toErrorResponse(error, 'staff set-password');
  }
}
