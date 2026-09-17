import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { CreateSaleSchema } from '@/lib/validators/sale.validators';
import { createSale, getSales } from '@/lib/services/sale.service';
import { createCommissionRecord } from '@/lib/services/commission.service';
import { parseQueryDate, parsePagination } from '@/lib/api/query-params';
import { isApiError } from '@/lib/api/errors';
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
    // M14-02 (BUG-45): XC-01 parsing — malformed from/to/page/limit now 400
    // VALIDATION_ERROR naming the param instead of leaking an Invalid Date /
    // NaN into Prisma and surfacing as an unhandled 500.
    const from = parseQueryDate(url.searchParams, 'from');
    const to = parseQueryDate(url.searchParams, 'to');
    const { page, limit } = parsePagination(url.searchParams);

    const result = await getSales(tenantId, { shiftId, cashierId, status, from, to, page, limit });

    return NextResponse.json({
      success: true,
      data: result.sales,
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.message },
        },
        { status: 400 },
      );
    }
    console.error('GET /api/store/sales error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      },
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
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors },
        },
        { status: 400 },
      );
    }

    // Sales created from the management page are intentionally shiftless. The
    // POS terminal still sends a shiftId and remains available to cashiers.
    // XC-03: the inline owner/manager comparison is replaced by a registry key,
    // so the rule and the role list cannot drift apart.
    if (
      parsed.data.shiftId === undefined &&
      !hasPermission(session.user, PERMISSIONS.SALE.createSaleWithoutShift)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'A POS shift is required for cashier sales' },
        },
        { status: 403 },
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

    // Notification side-effect — non-blocking
    try {
      const recipients = await prisma.user.findMany({
        where: { tenantId, role: { in: ['OWNER', 'MANAGER'] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (recipients.length > 0) {
        const shortId = sale.id.slice(0, 8).toUpperCase();
        await prisma.notificationRecord.createMany({
          data: recipients.map((r) => ({
            tenantId,
            recipientId: r.id,
            type: 'SALE_COMPLETED' as const,
            title: 'Sale Completed',
            body: `Sale #${shortId} completed for Rs. ${Number(sale.totalAmount).toFixed(2)}.`,
            relatedEntityType: 'Sale',
            relatedEntityId: sale.id,
          })),
        });
      }
    } catch (notifError) {
      console.warn('Sale notification creation failed:', notifError);
    }

    return NextResponse.json({ success: true, data: sale }, { status: 201 });
  } catch (error) {
    // M14-01 / M14-04: the service throws typed `ApiError`s for guards the
    // validator cannot express (NONE on a non-zero total → 422, unknown
    // defectiveBarcode → 400). Preserve status + code; never fall to the 500.
    if (isApiError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined ? { details: error.details } : {}),
          },
        },
        { status: error.status },
      );
    }

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
      {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      },
      { status: 500 },
    );
  }
}
