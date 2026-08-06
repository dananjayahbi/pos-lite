/**
 * GET /api/public/site/[tenantSlug]/categories/[categoryId]
 *
 * Public single category for a tenant. Returns a category plus its active
 * product count. Used by the storefront category page so it no longer has to
 * fetch the full category list and filter client-side.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';

interface RouteContext {
  params: Promise<{ tenantSlug: string; categoryId: string }>;
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { tenantSlug, categoryId } = await context.params;

  if (!tenantSlug || tenantSlug.length > 64 || !categoryId) {
    return errorWithCors(request, 400, 'Invalid tenant slug or category id');
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

  const category = await prisma.category.findFirst({
    where: { id: categoryId, tenantId: tenant.id, deletedAt: null, parentId: null },
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

  if (!category) {
    return errorWithCors(request, 404, 'Category not found');
  }

  const payload = {
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    productCount: category._count.products,
  };

  return jsonWithCors(
    request,
    { category: payload },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
