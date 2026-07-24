/**
 * GET /api/public/site/[tenantSlug]/brands
 *
 * Public brands for a tenant. Sorted by name.
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

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

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

  const brands = await prisma.brand.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { name: 'asc' },
    take: limit,
  });

  return jsonWithCors(
    request,
    {
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        logoUrl: b.logoUrl,
      })),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    },
  );
}