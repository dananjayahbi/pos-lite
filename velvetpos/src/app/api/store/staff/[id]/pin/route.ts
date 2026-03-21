import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@/generated/prisma/client';

export async function PATCH(
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

    const userRole = session.user.role as UserRole;
    if (userRole !== UserRole.MANAGER && userRole !== UserRole.OWNER) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Managers and Owners can manage PINs' } },
        { status: 403 },
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

    const targetUser = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'User not found or does not belong to your tenant' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { newPin } = body;

    if (typeof newPin !== 'string' || !/^\d{4,8}$/.test(newPin)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'PIN must be 4 to 8 digits' } },
        { status: 400 },
      );
    }

    const hashedPin = await bcrypt.hash(newPin, 12);

    await prisma.user.update({
      where: { id },
      data: { pin: hashedPin },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'PIN updated successfully', updatedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error('PATCH /api/store/staff/[id]/pin error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
