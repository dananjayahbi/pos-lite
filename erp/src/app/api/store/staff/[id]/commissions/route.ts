import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCommissionsForUser } from '@/lib/services/commission.service';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt } from '@/lib/api/query-params';

export async function GET(
  request: NextRequest,
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

    const { id } = await params;

    // M20-01 (XC-03): "own records OR staff-management permission" — expressed as
    // a permission key rather than a hard-coded MANAGER/OWNER list.
    if (id !== session.user.id && !hasPermission(session.user, PERMISSIONS.STAFF.viewStaff)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You can only view your own commission records' } },
        { status: 403 },
      );
    }

    const url = request.nextUrl;
    // XC-01: malformed page/pageSize now 400 instead of NaN → 500.
    const page = parseQueryInt(url.searchParams, 'page', { default: 1, min: 1, max: 1_000_000 }) ?? 1;
    const pageSize = parseQueryInt(url.searchParams, 'pageSize', { default: 20, min: 1, max: 200 }) ?? 20;

    const result = await getCommissionsForUser(tenantId, id, page, pageSize);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/staff/[id]/commissions');
  }
}
