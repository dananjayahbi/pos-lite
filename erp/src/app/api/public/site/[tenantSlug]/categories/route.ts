/**
 * GET /api/public/site/[tenantSlug]/categories
 *
 * Public categories for a tenant. Top-level only (no nested `parentId`).
 * Sorted by `sortOrder` then name.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { tenantSlug } = await context.params;

  if (!tenantSlug || tenantSlug.length > 64) {
    return errorWithCors(request, 400, 'Invalid tenant slug');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!tenant) {
    return errorWithCors(request, 404, 'Tenant not found');
  }

  if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
    return errorWithCors(request, 403, 'Storefront unavailable');
  }

  const url = new URL(request.url);
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const categories = await prisma.category.findMany({
    where: { tenantId: tenant.id, deletedAt: null, parentId: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: limit,
    include: {
      _count: {
        select: {
          products: {
            where: { isArchived: false, deletedAt: null },
          },
        },
      },
    },
  });

  const payload = categories
    .filter((cat) => cat._count.products > 0)
    .map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    sortOrder: cat.sortOrder,
    productCount: cat._count.products,
  }));

  return jsonWithCors(
    request,
    { categories: payload },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}