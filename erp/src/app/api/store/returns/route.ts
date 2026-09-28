import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ReturnCreateSchema } from '@/lib/validators/return.validators';
import { initiateReturn, getReturns } from '@/lib/services/return.service';
import { createNegativeCommissionRecord } from '@/lib/services/commission.service';
import { prisma } from '@/lib/prisma';
import { parsePagination, parseQueryDate } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { ApiError, isApiError } from '@/lib/api/errors';
import type { ReturnRefundMethod } from '@/generated/prisma/client';

/**
 * M17-02 (BUG-51) — XC-01 query parsers throw a 400 `BAD_REQUEST`; the
 * Module 17 GET contract (and its QA pin) is `400 VALIDATION_ERROR` naming the
 * offending param, so the parse errors are promoted here.
 */
function parseValidated<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (isApiError(error) && error.status === 400) {
      throw new ApiError(400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
  }
}

/**
 * POST /api/store/returns — process a refund/return.
 *
 * M17-01 (BUG-50): the catch delegates to the shared INF-02 mapper, so the
 * return-eligibility family is sentinel-driven (`SALE_NOT_FOUND`,
 * `RETURN_WINDOW_EXPIRED`, `RETURN_QTY_EXCEEDS_RETURNABLE`, … → 422) and a
 * cross-tenant `originalSaleId` fails closed as a typed 404
 * (`FOREIGN_TENANT_RESOURCE`) instead of falling through to a 500. The 201
 * happy-path envelope is unchanged.
 */
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

    if (!hasPermission(session.user, PERMISSIONS.SALE.refundSale)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = ReturnCreateSchema.safeParse(body);
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

    const data = parsed.data;

    // If an authorizing manager was provided, verify they are a manager+ in the same tenant
    if (data.authorizedById) {
      const authorizer = await prisma.user.findFirst({
        where: { id: data.authorizedById, tenantId, isActive: true },
        select: { role: true },
      });

      if (!authorizer || !['MANAGER', 'OWNER', 'SUPER_ADMIN'].includes(authorizer.role)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Authorizing user is not a manager in this tenant' } },
          { status: 403 },
        );
      }
    }

    const result = await initiateReturn(tenantId, {
      initiatedById: session.user.id,
      authorizedById: data.authorizedById ?? null,
      originalSaleId: data.originalSaleId,
      lines: data.lines,
      refundMethod: data.refundMethod,
      restockItems: data.restockItems,
      reason: data.reason,
    });

    // Negative commission side-effect — non-blocking
    try {
      await createNegativeCommissionRecord(result.id, tenantId);
    } catch (commissionError) {
      console.warn('Negative commission record creation failed:', commissionError);
    }

    // Notification side-effect — non-blocking
    try {
      const recipients = await prisma.user.findMany({
        where: { tenantId, role: { in: ['OWNER', 'MANAGER'] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (recipients.length > 0) {
        const shortId = data.originalSaleId.slice(0, 8).toUpperCase();
        await prisma.notificationRecord.createMany({
          data: recipients.map((r) => ({
            tenantId,
            recipientId: r.id,
            type: 'RETURN_PROCESSED' as const,
            title: 'Return Processed',
            body: `A return was processed for sale #${shortId} via ${data.refundMethod.replace('_', ' ').toLowerCase()}.`,
            relatedEntityType: 'SaleReturn',
            relatedEntityId: result.id,
          })),
        });
      }
    } catch (notifError) {
      console.warn('Return notification creation failed:', notifError);
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    // M17-01 (BUG-50): one mapper for the whole return-eligibility family —
    // typed sentinels (422) plus the cross-tenant 404. Unknown errors stay a
    // logged, leak-free 500.
    return toErrorResponse(error, 'POST /api/store/returns');
  }
}

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
    const originalSaleId = url.searchParams.get('originalSaleId') ?? undefined;
    const refundMethod = (url.searchParams.get('refundMethod') as ReturnRefundMethod) ?? undefined;
    // M17-02 (BUG-51): XC-01 parsing — a malformed `from`/`to` is a typed 400
    // VALIDATION_ERROR naming the param instead of an Invalid Date reaching
    // Prisma as an unhandled 500. page/limit go through the same helper so
    // `page=abc` is a typed 400 rather than NaN.
    const from = parseValidated(() => parseQueryDate(url.searchParams, 'from'));
    const to = parseValidated(() => parseQueryDate(url.searchParams, 'to'));
    const { page, limit } = parseValidated(() =>
      parsePagination(url.searchParams, { defaultLimit: 25, maxLimit: 100 }),
    );

    const result = await getReturns(tenantId, { originalSaleId, refundMethod, from, to, page, limit });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    // XC-01/INF-02: parser ApiErrors surface as their typed 400; unknown errors
    // are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'GET /api/store/returns');
  }
}
