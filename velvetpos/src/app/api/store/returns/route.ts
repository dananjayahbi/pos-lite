import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ReturnCreateSchema } from '@/lib/validators/return.validators';
import { initiateReturn, getReturns } from '@/lib/services/return.service';
import { prisma } from '@/lib/prisma';
import type { ReturnRefundMethod } from '@/generated/prisma/client';

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

    // Verify authorizedById is a manager+ in same tenant
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

    const result = await initiateReturn(tenantId, {
      initiatedById: session.user.id,
      authorizedById: data.authorizedById,
      originalSaleId: data.originalSaleId,
      lines: data.lines,
      refundMethod: data.refundMethod,
      restockItems: data.restockItems,
      reason: data.reason,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    // Service-layer validation errors (return window, quantity)
    if (message.includes('Return window expired') ||
        message.includes('Cannot return') ||
        message.includes('Sale status must be') ||
        message.includes('Sale not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNPROCESSABLE', message } },
        { status: 422 },
      );
    }

    console.error('POST /api/store/returns error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
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
    const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : undefined;
    const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : undefined;
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1;
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 25;

    const result = await getReturns(tenantId, { originalSaleId, refundMethod, from, to, page, limit });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    console.error('GET /api/store/returns error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
