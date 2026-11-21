import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus } from '@/generated/prisma/client';
import { isStaleStockTake } from '@/lib/services/stockTakeAge.core';
import {
  parseStockTakeCategoryId,
  stockTakeCategoryListWhere,
  stockTakeCategoryLookupWhere,
} from '@/lib/services/stockTakePolicy.core';

export async function GET() {
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

    // ARGUS #205 — stock-take reads use the same permission as counting.
    if (!hasPermission(session.user, PERMISSIONS.STOCK.conductStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const sessions = await prisma.stockTakeSession.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      include: {
        initiatedBy: { select: { email: true } },
        items: {
          select: { id: true, discrepancy: true },
        },
      },
    });

    // Fetch category names for sessions that have a categoryId
    const categoryIds = sessions
      .map((s) => s.categoryId)
      .filter((id): id is string => id !== null);

    const categories =
      categoryIds.length > 0
        ? await prisma.category.findMany({
            // ARGUS #209: a foreign/deleted category id must never resolve a
            // name into this tenant's session list.
            where: stockTakeCategoryListWhere(tenantId, categoryIds),
            select: { id: true, name: true },
          })
        : [];

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const data = sessions.map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      categoryName: s.categoryId ? (categoryMap.get(s.categoryId) ?? null) : null,
      status: s.status,
      initiatedById: s.initiatedById,
      initiatedBy: s.initiatedBy.email,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      approvedAt: s.approvedAt?.toISOString() ?? null,
      notes: s.notes,
      itemCount: s.items.length,
      discrepancyCount: s.items.filter(
        (i) => i.discrepancy !== null && i.discrepancy !== 0,
      ).length,
    }));

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stock take sessions' } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const parsedCategory = parseStockTakeCategoryId(
      body && typeof body === 'object'
        ? (body as { categoryId?: unknown }).categoryId
        : undefined,
    );
    if (!parsedCategory.ok) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsedCategory.message,
            details: [{ path: 'categoryId', message: parsedCategory.message }],
          },
        },
        { status: 400 },
      );
    }

    const categoryId = parsedCategory.categoryId;

    // ARGUS #209: the optional category must exist, be live and belong to this
    // tenant. Reject before creating a session (a foreign id must not leak its
    // name through the list, and an unknown id must not create an empty
    // session).
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: stockTakeCategoryLookupWhere(tenantId, categoryId),
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json(
          { success: false, error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } },
          { status: 404 },
        );
      }
    }

    // Check no IN_PROGRESS session exists
    const existing = await prisma.stockTakeSession.findFirst({
      where: { tenantId, status: StockTakeStatus.IN_PROGRESS },
    });

    if (existing) {
      const stale = isStaleStockTake(existing.startedAt, existing.status);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: `An in-progress stock take session (${existing.id.slice(0, 8)}, started ${existing.startedAt.toISOString().slice(0, 10)}) already exists. Complete or cancel it before starting a new one${stale ? ' - it is stale (older than 7 days)' : ''}.`,
            details: { sessionId: existing.id, startedAt: existing.startedAt.toISOString(), stale },
          },
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const newSession = await tx.stockTakeSession.create({
        data: {
          tenantId,
          categoryId,
          initiatedById: session.user.id,
        },
      });

      // Find all non-deleted variants for tenant, filtered by categoryId if provided
      const variants = await tx.productVariant.findMany({
        where: {
          tenantId,
          deletedAt: null,
          product: {
            deletedAt: null,
            isArchived: false,
            ...(categoryId ? { categoryId } : {}),
          },
        },
        select: { id: true, stockQuantity: true },
      });

      if (variants.length > 0) {
        await tx.stockTakeItem.createMany({
          data: variants.map((v) => ({
            sessionId: newSession.id,
            variantId: v.id,
            systemQuantity: v.stockQuantity,
          })),
        });
      }

      return newSession.id;
    });

    return NextResponse.json({ success: true, data: { id: result } }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create stock take session' } },
      { status: 500 },
    );
  }
}
