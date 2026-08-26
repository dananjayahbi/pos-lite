/**
 * GET /api/public/site/[tenantSlug]/products
 *
 * List active products for a tenant. Supports filtering by category/brand
 * and sorting by latest / best-selling / price. Caches for 60s on the edge.
 *
 * Returns products with all non-deleted variants so the storefront can
 * pick a primary variant (typically the lowest-priced in-stock one) for
 * display.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { HealthConcern, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

type SortKey = 'latest' | 'best-selling' | 'price-asc' | 'price-desc';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const ALLOWED_SORTS: ReadonlyArray<SortKey> = [
  'latest',
  'best-selling',
  'price-asc',
  'price-desc',
];

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

  // Parse query params
  const url = new URL(request.url);
  const sortParam = url.searchParams.get('sort') ?? 'latest';
  const sort: SortKey = (ALLOWED_SORTS as ReadonlyArray<string>).includes(sortParam)
    ? (sortParam as SortKey)
    : 'latest';

  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const brandId = url.searchParams.get('brandId') ?? undefined;
  const form = url.searchParams.get('form') ?? undefined;
  const q = url.searchParams.get('q')?.trim() || undefined;
  const concernRaw = url.searchParams.get('concern') ?? undefined;

  // Optional price range — applied in memory against the min retail price.
  const priceMinRaw = url.searchParams.get('priceMin') ?? undefined;
  const priceMaxRaw = url.searchParams.get('priceMax') ?? undefined;
  const priceMin = priceMinRaw !== undefined ? Number(priceMinRaw) : undefined;
  const priceMax = priceMaxRaw !== undefined ? Number(priceMaxRaw) : undefined;

  // Validate the concern is a known enum value to avoid a runtime query error.
  const concern = concernRaw && (Object.values(HealthConcern) as string[]).includes(concernRaw)
    ? (concernRaw as HealthConcern)
    : undefined;

  // Keyword search across name, description, tags and the structured health
  // content fields (case-insensitive substring on PostgreSQL).
  const searchOr: Prisma.ProductWhereInput[] = q
    ? [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
        { activeIngredients: { contains: q, mode: 'insensitive' } },
        { usageInstructions: { contains: q, mode: 'insensitive' } },
        { healthBenefits: { contains: q, mode: 'insensitive' } },
        { safetyPrecautions: { contains: q, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
      ]
    : [];

  // Build the orderBy clause. "best-selling" is approximated by recent sales
  // volume; we fallback to latest for simplicity here — wire this to your
  // sales aggregation once a proper "best-selling" query is available.
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case 'price-asc':
      case 'price-desc':
      default:
        // price sorts are applied in memory against min retail price
        return [{ createdAt: 'desc' }];
      case 'best-selling':
        return [{ createdAt: 'desc' }];
      case 'latest':
        return [{ createdAt: 'desc' }];
    }
  })();

  // Note: no `take` here — price filtering is done in memory against the min
  // retail price, so we must fetch all matching products and slice afterwards.
  const products = await prisma.product.findMany({
    where: {
      tenantId: tenant.id,
      isArchived: false,
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(concern ? { healthConcerns: { has: concern } } : {}),
      ...(q ? { OR: searchOr } : {}),
      variants: {
        some: { deletedAt: null, ...(form ? { form } : {}) },
      },
    },
    orderBy,
    include: {
      variants: {
        where: { deletedAt: null },
        orderBy: { retailPrice: 'asc' },
      },
    },
  });

  const items = products.map((product) => {
    const variants = product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      form: v.form,
      retailPrice: asNumber(v.retailPrice),
      imageUrls: v.imageUrls,
      stockQuantity: v.stockQuantity,
      productId: v.productId,
    }));
    const primary = variants[0] ?? null;

    // For price filter/sort, use the min retail price (deterministic compare).
    const minPrice = variants.reduce(
      (acc, v) => (v.retailPrice < acc ? v.retailPrice : acc),
      Number.POSITIVE_INFINITY,
    );

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      brandId: product.brandId,
      tags: product.tags,
      healthConcerns: product.healthConcerns,
      mainImageUrl: product.mainImageUrl,
      primaryVariant: primary,
      variants,
      _minPrice: Number.isFinite(minPrice) ? minPrice : 0,
    };
  });

  // Apply the price-range filter in memory.
  const inPriceRange =
    priceMin === undefined && priceMax === undefined
      ? true
      : (item: { _minPrice: number }) => {
          if (priceMin !== undefined && item._minPrice < priceMin) return false;
          if (priceMax !== undefined && item._minPrice > priceMax) return false;
          return true;
        };

  const priceFiltered =
    inPriceRange === true ? items : items.filter(inPriceRange);

  // Final sort if price-based.
  if (sort === 'price-asc') {
    priceFiltered.sort((a, b) => a._minPrice - b._minPrice);
  } else if (sort === 'price-desc') {
    priceFiltered.sort((a, b) => b._minPrice - a._minPrice);
  }

  const paginated = priceFiltered.slice(0, limit);

  const cleaned = paginated.map((item) => {
    // Drop the internal _minPrice helper used only for filtering/sorting above.
    const { _minPrice: _drop, ...rest } = item;
    void _drop;
    return rest;
  });

  return jsonWithCors(
    request,
    { products: cleaned, total: priceFiltered.length },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}