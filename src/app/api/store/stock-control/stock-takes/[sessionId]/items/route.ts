import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus } from '@/generated/prisma/client';

const AddItemSchema = z.object({
  variantId: z.string().min(1, { error: 'Variant ID is required' }),
});

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ sessionId: string }> },
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

    if (!hasPermission(session.user, PERMISSIONS.STOCK.conductStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { sessionId } = await props.params;

    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
    });

    if (!stockTakeSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock take session not found' } },
        { status: 404 },
      );
    }

    if (stockTakeSession.status !== StockTakeStatus.IN_PROGRESS) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Session is not in progress' } },
        { status: 409 },
      );
    }

    const body: unknown = await request.json();
    const parsed = AddItemSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors } },
        { status: 400 },
      );
    }

    const { variantId } = parsed.data;

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, tenantId, deletedAt: null },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        product: { select: { name: true } },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Variant not found' } },
        { status: 404 },
      );
    }

    const existingItem = await prisma.stockTakeItem.findFirst({
      where: { sessionId, variantId },
    });

    if (existingItem) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'This variant is already included in the session' } },
        { status: 409 },
      );
    }

    const newItem = await prisma.stockTakeItem.create({
      data: {
        sessionId,
        variantId,
        systemQuantity: variant.stockQuantity,
      },
      include: {
        variant: {
          select: {
            sku: true,
            barcode: true,
            size: true,
            colour: true,
            product: {
              select: {
                name: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (error) {
    console.error('Add stock take item error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add item to stock take' } },
      { status: 500 },
    );
  }
}
