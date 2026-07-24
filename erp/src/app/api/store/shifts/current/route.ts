import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentShift } from '@/lib/services/shift.service';

export async function GET() {
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

    const shift = await getCurrentShift(tenantId, session.user.id);

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    console.error('GET /api/store/shifts/current error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
