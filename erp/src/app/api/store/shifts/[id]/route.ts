import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getShiftById } from '@/lib/services/shift.service';
import { resolveShiftAccessForUser } from '@/lib/shifts/shift-access-request';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
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

    // ARGUS #111: non-managers may only read their own shift. Scoping the query
    // (rather than fetching then checking) also returns 404 for someone else's
    // shift, so the endpoint cannot be used to probe ids.
    const scope = resolveShiftAccessForUser(session.user);
    if (scope.kind === 'forbidden') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await props.params;
    const shift = await getShiftById(
      tenantId,
      id,
      scope.kind === 'own' ? scope.cashierId : undefined,
    );

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'Shift not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    console.error('GET /api/store/shifts/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
