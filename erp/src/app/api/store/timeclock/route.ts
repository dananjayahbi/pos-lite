import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTimeClockHistory } from '@/lib/services/timeclock.service';

export async function GET(request: NextRequest) {
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

    const url = request.nextUrl;
    const userId = url.searchParams.get('userId') ?? session.user.id;

    if (userId !== session.user.id && !['MANAGER', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot view other users\' time clock records' } },
        { status: 403 },
      );
    }

    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1;
    const pageSize = url.searchParams.get('pageSize') ? Number(url.searchParams.get('pageSize')) : 20;

    const result = await getTimeClockHistory(tenantId, userId, page, pageSize);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /api/store/timeclock error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
