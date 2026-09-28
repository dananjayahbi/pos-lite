import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getStaffMembers, createStaffMember } from '@/lib/services/staff.service';
import { CreateStaffSchema } from '@/lib/validators/staff.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.STAFF.viewStaff)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const staff = await getStaffMembers(tenantId, {
      search: searchParams.get('search') ?? undefined,
    });

    return NextResponse.json({ success: true, data: staff });
  } catch (error) {
    console.error('GET /api/store/staff error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = CreateStaffSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const staff = await createStaffMember(tenantId, parsed.data);

    return NextResponse.json({ success: true, data: staff }, { status: 201 });
  } catch (error) {
    // M03-06 (BUG-8): P2002 races now surface as a typed 409 CONFLICT via the
    // INF-02 mapper — never a 500. The escalation guard prose keeps its exact
    // 400 VALIDATION_ERROR contract (tests 8.7/8.8).
    const message = error instanceof Error ? error.message : '';
    if (message === 'Cannot assign SUPER_ADMIN role') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message } },
        { status: 400 },
      );
    }

    return toErrorResponse(error, 'staff create');
  }
}
