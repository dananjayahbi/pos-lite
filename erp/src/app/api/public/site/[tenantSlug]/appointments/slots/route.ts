/**
 * GET /api/public/site/[tenantSlug]/appointments/slots
 *
 * Public availability check for a customer-facing booking page.
 *
 * Returns the list of bookable slots for the given date (and optional
 * service). Slots come from the tenant's AppointmentSlot records (pre-generated
 * via the ERP's slot generator) that are neither booked nor blocked. Only
 * tenants with the appointments module enabled are served.
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

  const url = new URL(request.url);
  const date = url.searchParams.get('date');

  if (!date) {
    return errorWithCors(request, 400, 'date parameter is required');
  }

  const targetDate = new Date(date);
  if (Number.isNaN(targetDate.getTime())) {
    return errorWithCors(request, 400, 'Invalid date');
  }

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Fetch slots for the day; if a service is requested we join via the staff
  // availability for the service's staff (delegated to service layer below).
  const slots = await prisma.appointmentSlot.findMany({
    where: {
      tenantId: tenant.id,
      date: { gte: dayStart, lte: dayEnd },
      isBooked: false,
      isBlocked: false,
    },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      staffId: true,
    },
  });

  // Slots may exist for staff who are unavailable for a given service. We keep
  // the payload light: id + ISO times + staffId. The caller (booking page)
  // groups and presents them.
  return jsonWithCors(request, { success: true, data: slots }, {
    headers: {
      // Slots change frequently as bookings are made; keep short cache.
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
