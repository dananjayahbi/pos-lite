/**
 * GET /api/public/site/[tenantSlug]/appointment-services
 *
 * Public list of active appointment services for a tenant, exposing only
 * the fields a customer needs to book: id, name, description, durationMins,
 * price, and color. Returns an empty array for tenants that have the
 * appointments module disabled.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';
import { isModuleEnabled } from '@/lib/feature-guard';

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
    select: { id: true, status: true, settings: true },
  });

  if (!tenant) {
    return errorWithCors(request, 404, 'Tenant not found');
  }

  if (tenant.status === 'SUSPENDED') {
    return errorWithCors(request, 403, 'Storefront unavailable');
  }

  if (!isModuleEnabled((tenant.settings ?? {}) as Record<string, unknown>, 'appointments')) {
    return jsonWithCors(request, { success: true, data: [] });
  }

  const services = await prisma.appointmentService.findMany({
    where: { tenantId: tenant.id, deletedAt: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      durationMins: true,
      price: true,
      color: true,
    },
  });

  return jsonWithCors(request, { success: true, data: services }, {
    headers: {
      // Public cache: 60s, stale-while-revalidate 5 minutes
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
