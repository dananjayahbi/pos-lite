import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { CreateSaleSchema } from '@/lib/validators/sale.validators';
import { createSale, getSales } from '@/lib/services/sale.service';
import { createCommissionRecord } from '@/lib/services/commission.service';
import { prisma } from '@/lib/prisma';
import type { SaleStatus } from '@/generated/prisma/client';

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

    if (!hasPermission(session.user, PERMISSIONS.SALE.viewSale)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const url = request.nextUrl;
    const shiftId = url.searchParams.get('shiftId') ?? undefined;
    const cashierId = url.searchParams.get('cashierId') ?? undefined;
    const status = (url.searchParams.get('status') as SaleStatus) ?? undefined;
    const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : undefined;
    const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : undefined;
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1;
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20;

    const result = await getSales(tenantId, { shiftId, cashierId, status, from, to, page, limit });

    return NextResponse.json({
      success: true,
      data: result.sales,
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    console.error('GET /api/store/sales error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.SALE.createSale)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateSaleSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const sale = await createSale(tenantId, { ...parsed.data, cashierId: session.user.id });

    // Commission side-effect — non-blocking, warning only on failure
    try {
      const cashier = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { commissionRate: true },
      });
      if (cashier?.commissionRate) {
        await createCommissionRecord({
          tenantId,
          saleId: sale.id,
          userId: session.user.id,
          baseAmount: sale.totalAmount,
          commissionRate: cashier.commissionRate,
        });
      }
    } catch (commissionError) {
      console.warn('Commission record creation failed:', commissionError);
    }

    return NextResponse.json({ success: true, data: sale }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('not found') || message.includes('not open')) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message } },
        { status: 400 },
      );
    }
    if (message.includes('Insufficient stock')) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message } },
        { status: 409 },
      );
    }
    if (message.includes('discount cannot exceed')) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message } },
        { status: 400 },
      );
    }

    console.error('POST /api/store/sales error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
