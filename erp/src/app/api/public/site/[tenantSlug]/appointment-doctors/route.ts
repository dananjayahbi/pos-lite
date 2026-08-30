/**
 * GET /api/public/site/[tenantSlug]/appointment-doctors
 *
 * Public list of bookable physicians (staff who have generated appointment
 * slots) for a tenant. Returns id + email (the User model has no name field,
 * so the email is the display handle). Returns an empty array for tenants
 * that have the appointments module disabled.
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

  // Distinct staff who have at least one generated slot → the bookable doctors.
  const staff = await prisma.appointmentSlot.findMany({
    where: { tenantId: tenant.id },
    distinct: ['staffId'],
    select: {
      staff: { select: { id: true, email: true, isActive: true, deletedAt: true } },
    },
  });

  const doctors = staff
    .map((s) => s.staff)
    .filter((s) => s.isActive && !s.deletedAt)
    .map((s) => ({ id: s.id, name: s.email, email: s.email }));

  return jsonWithCors(request, { success: true, data: doctors }, {
    headers: {
      // Public cache: 60s, stale-while-revalidate 5 minutes
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
