import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

function defaultFrom(): Date {
  // Last 24 hours by default (doc 35: configurable window).
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function defaultTo(): Date {
  return new Date();
}

const REASON_LABELS: Record<string, string> = {
  BANK_PAYMENT: 'Bank Payment',
  PRODUCT_REPLACEMENT: 'Product Replacement',
  COMPLIMENTARY_GIFT: 'Complimentary Gift',
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorJson('UNAUTHORIZED', 'Not authenticated', 401);
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return errorJson('UNAUTHORIZED', 'No tenant', 401);
    }
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.REPORT.viewZeroValueReport);
    if (forbidden) return forbidden;

    const url = request.nextUrl;
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom();
    const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return errorJson('BAD_REQUEST', 'Invalid date parameters', 400);
    }

    const where = {
      tenantId,
      status: 'COMPLETED' as const,
      totalAmount: 0,
      createdAt: { gte: from, lte: to },
    };

    const [sales, reasonGroups] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          cashier: { select: { id: true, email: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.groupBy({
        by: ['zeroValueReason'],
        where,
        _count: { _all: true },
      }),
    ]);

    const rows = sales.map((sale) => ({
      saleId: sale.id,
      staff: sale.cashier?.email ?? 'Unknown',
      reason: sale.zeroValueReason ?? null,
      reasonLabel: sale.zeroValueReason ? REASON_LABELS[sale.zeroValueReason] ?? sale.zeroValueReason : '—',
      linkedOrderRef: sale.zeroValueLinkedOrderRef ?? null,
      customerName: sale.customer?.name ?? '—',
      customerPhone: sale.customer?.phone ?? '—',
      saleNumber: sale.id.slice(0, 8).toUpperCase(),
      completedAt: sale.completedAt?.toISOString() ?? sale.createdAt.toISOString(),
    }));

    const summaryByReason = Object.fromEntries(
      reasonGroups.map((g) => [
        g.zeroValueReason ?? 'UNSPECIFIED',
        g._count._all,
      ]),
    );

    return NextResponse.json({
      success: true,
      data: {
        rows,
        summaryByReason,
        total: sales.length,
      },
    });
  } catch (err) {
    console.error('[zero-value-sales-report]', err);
    return errorJson('INTERNAL', 'Failed to generate report', 500);
  }
}
