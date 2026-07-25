/**
 * GET /api/public/site/[tenantSlug]/config
 *
 * Returns the public-facing website configuration for a tenant:
 *  - branding (siteName, logo, colors)
 *  - navigation menu
 *  - section ordering / per-section config
 *  - active hero slides
 *  - active & currently-scheduled ads
 *  - footer columns + social links
 *
 * This endpoint is the single source of truth for the storefront's layout.
 * It is public (no auth) but only returns data for tenants that are not
 * suspended and not soft-deleted.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicWebsiteConfig } from '@/lib/services/website.service';
import {
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

  const config = await getPublicWebsiteConfig(tenant.id);

  // Strip the status field from the tenant portion of the response.
  const publicTenant = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logoUrl: tenant.logoUrl,
  };

  return jsonWithCors(
    request,
    { tenant: publicTenant, config },
    {
      headers: {
        // Public cache: 60s, stale-while-revalidate 5 minutes
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}