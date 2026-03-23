import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      );
    }

    const { id } = await params;

    const deleted = await prisma.savedReport.deleteMany({
      where: {
        id,
        tenantId,
        userId: session.user.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/reports/saved/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete saved report' } },
      { status: 500 },
    );
  }
}