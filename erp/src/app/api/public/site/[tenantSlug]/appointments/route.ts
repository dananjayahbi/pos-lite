/**
 * POST /api/public/site/[tenantSlug]/appointments
 *
 * Public appointment booking from the customer-facing storefront.
 *
 * Creates a walk-in appointment (customer supplies name + phone). No auth —
 * CORS-enabled, tenant resolved by slug, appointments module gated. The
 * acting user is resolved to the tenant's OWNER so the booking is attributed
 * to the business.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';
import { isModuleEnabled } from '@/lib/feature-guard';
import { createPublicAppointment } from '@/lib/services/public-appointment.service';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

const PublicBookingSchema = z.object({
  walkInName: z.string().min(1, 'Name is required').max(100),
  walkInPhone: z.string().min(1, 'Phone is required').max(20),
  serviceId: z.string().optional().nullable(),
  slotId: z.string().optional().nullable(),
  staffId: z.string().optional().nullable(),
  startTime: z.string().datetime({ message: 'Start time must be a valid ISO datetime' }),
  endTime: z.string().datetime({ message: 'End time must be a valid ISO datetime' }),
  durationMins: z.number().int().min(5),
  price: z.number().min(0),
  notes: z.string().max(1000).optional().nullable(),
});

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request);
}

export async function POST(
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
    return errorWithCors(request, 409, 'Appointment booking is not enabled');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorWithCors(request, 400, 'Invalid JSON body');
  }

  const parsed = PublicBookingSchema.safeParse(body);
  if (!parsed.success) {
    return errorWithCors(
      request,
      400,
      parsed.error.issues.map((i) => i.message).join(', '),
    );
  }

  try {
    // Strip undefined optional fields (exactOptionalPropertyTypes requires
    // that we never pass an explicit `undefined` for an optional prop).
    const input = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    ) as {
      walkInName: string;
      walkInPhone: string;
      startTime: string;
      endTime: string;
      durationMins: number;
      price: number;
      serviceId?: string | null;
      slotId?: string | null;
      staffId?: string | null;
      notes?: string | null;
    };

    const appointment = await createPublicAppointment(tenant.id, input);

    // Bust the storefront's cached config/tenant pages so the booking page
    // reflects the new availability immediately.
    await revalidateTenantStorefront(tenant.id, { config: true });

    return jsonWithCors(request, { success: true, data: appointment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (message === 'STAFF_UNAVAILABLE') {
      return errorWithCors(request, 409, 'That time slot is no longer available. Please pick another.');
    }
    if (message === 'SERVICE_NOT_FOUND') {
      return errorWithCors(request, 404, 'The selected service is unavailable.');
    }
    // eslint-disable-next-line no-console
    console.error('POST /api/public/site/[tenantSlug]/appointments error:', error);
    return errorWithCors(request, 500, 'Failed to book appointment. Please try again.');
  }
}
