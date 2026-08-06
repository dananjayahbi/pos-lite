/**
 * GET /api/public/site/[tenantSlug]/products/[productId]
 *
 * Single product detail for the storefront. Returns the product with all
 * non-deleted variants. 404 when the product doesn't exist, is archived,
 * or belongs to a different tenant.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';

interface RouteContext {
  params: Promise<{ tenantSlug: string; productId: string }>;
}

function asNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { tenantSlug, productId } = await context.params;

  if (!tenantSlug || tenantSlug.length > 64) {
    return errorWithCors(request, 400, 'Invalid tenant slug');
  }
  if (!productId) {
    return errorWithCors(request, 400, 'Missing product id');
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

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      tenantId: tenant.id,
      isArchived: false,
      deletedAt: null,
    },
    include: {
      variants: {
        where: { deletedAt: null },
        orderBy: { retailPrice: 'asc' },
      },
    },
  });

  if (!product) {
    return errorWithCors(request, 404, 'Product not found');
  }

  const variants = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    retailPrice: asNumber(v.retailPrice),
    imageUrls: v.imageUrls,
    stockQuantity: v.stockQuantity,
    productId: v.productId,
  }));

  return jsonWithCors(
    request,
    {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        brandId: product.brandId,
        tags: product.tags,
        mainImageUrl: product.mainImageUrl,
        primaryVariant: variants[0] ?? null,
        variants,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}