import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCommissionsForUser } from '@/lib/services/commission.service';

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

    if (!['MANAGER', 'OWNER'].includes(session.user.role) && id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You can only view your own commission records' } },
        { status: 403 },
      );
    }

    const url = request.nextUrl;
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1;
    const pageSize = url.searchParams.get('pageSize') ? Number(url.searchParams.get('pageSize')) : 20;

    const result = await getCommissionsForUser(tenantId, id, page, pageSize);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /api/store/staff/[id]/commissions error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
