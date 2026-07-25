/**
 * GET /api/public/site/[tenantSlug]/tenant
 *
 * Lightweight tenant lookup used by the storefront to render <head> metadata
 * and to confirm the tenant exists before fetching the full config.
 *
 * Returns:
 *   - 200 with `{ tenant }` if the tenant is active (not deleted, not suspended)
 *   - 404 if the tenant slug is unknown
 *   - 403 if the tenant is suspended
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildCorsHeaders,
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
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
    select: { id: true, slug: true, name: true, logoUrl: true, status: true },
  });

  if (!tenant) {
    return errorWithCors(request, 404, 'Tenant not found');
  }

  if (tenant.status === 'SUSPENDED') {
    return errorWithCors(request, 403, 'Storefront unavailable');
  }

  // Strip the status field from the public response.
  const publicTenant = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logoUrl: tenant.logoUrl,
  };

  return jsonWithCors(request, { tenant: publicTenant }, {
    headers: { ...buildCorsHeaders(request) },
  });
}