import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { CashMovementType, ShiftStatus } from '@/generated/prisma/client';

const VALID_TYPES: CashMovementType[] = ['PETTY_CASH_OUT', 'MANUAL_IN', 'MANUAL_OUT'];

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

    const { id } = await props.params;

    const shift = await prisma.shift.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!shift) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Shift not found' } },
        { status: 404 },
      );
    }

    const movements = await prisma.cashMovement.findMany({
      where: { shiftId: id, tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        authorizedBy: { select: { email: true } },
      },
    });

    const data = movements.map((m) => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount),
      reason: m.reason,
      authorizedByName: m.authorizedBy?.email ?? null,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/store/shifts/[id]/cash-movements error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
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

    const { id } = await props.params;

    const shift = await prisma.shift.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });

    if (!shift) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Shift not found' } },
        { status: 404 },
      );
    }

    if (shift.status === ('CLOSED' satisfies ShiftStatus)) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Cannot add cash movements to a closed shift' } },
        { status: 409 },
      );
    }

    const body = await request.json();
    const { amount, reason, type } = body as { amount: unknown; reason: unknown; type: unknown };

    if (typeof type !== 'string' || !VALID_TYPES.includes(type as CashMovementType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid movement type' } },
        { status: 400 },
      );
    }

    const parsedAmount = typeof amount === 'number' ? amount : Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount >= 10000) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Amount must be between 0.01 and 9999.99' } },
        { status: 400 },
      );
    }

    if (reason !== undefined && reason !== null) {
      if (typeof reason !== 'string' || reason.length > 200) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason must be a string with max 200 characters' } },
          { status: 400 },
        );
      }
    }

    const movement = await prisma.cashMovement.create({
      data: {
        tenantId,
        shiftId: id,
        type: type as CashMovementType,
        amount: parsedAmount,
        reason: typeof reason === 'string' && reason.length > 0 ? reason : null,
        authorizedById: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: movement.id,
        type: movement.type,
        amount: Number(movement.amount),
        reason: movement.reason,
        createdAt: movement.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/shifts/[id]/cash-movements error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
