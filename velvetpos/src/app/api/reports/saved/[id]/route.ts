import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
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

    const savedReport = await prisma.savedReport.findFirst({
      where: { id, tenantId, userId: session.user.id },
    });

    if (!savedReport) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: savedReport });
  } catch (error) {
    console.error('GET /api/reports/saved/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load saved report' } },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
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

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 },
      );
    }

    const { id } = await params;
    const updated = await prisma.savedReport.updateMany({
      where: { id, tenantId, userId: session.user.id },
      data: { name },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Saved report not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/reports/saved/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update saved report' } },
      { status: 500 },
    );
  }
}

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