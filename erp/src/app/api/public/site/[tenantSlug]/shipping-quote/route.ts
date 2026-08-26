/**
 * POST /api/public/site/[tenantSlug]/shipping-quote
 *
 * Public delivery-fee estimate for the website checkout. Lets the customer see
 * the shipping cost as a line item before placing an order. This is a
 * display-only estimate; the authoritative fee is recomputed and stored server-
 * side by `createWebsiteOrder` at order placement so the displayed amount
 * matches exactly what lands on the ERP `Delivery.shippingFee`.
 *
 * No auth — CORS-enabled, tenant resolved by slug, delivery module gated.
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
import { estimateWebsiteShippingFee } from '@/lib/services/shipping-fee.service';

const QuoteSchema = z.object({
  cityName: z.string().min(1).max(120).optional(),
  districtName: z.string().max(120).optional(),
  totalWeightKg: z.number().min(0).optional(),
});

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

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
  if (!isModuleEnabled((tenant.settings ?? {}) as Record<string, unknown>, 'delivery')) {
    return errorWithCors(request, 409, 'Delivery ordering is not enabled');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorWithCors(request, 400, 'Invalid JSON body');
  }

  const parsed = QuoteSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return jsonWithCors(request, { success: false, error: 'Validation failed', details: errors }, { status: 422 });
  }

  try {
    const quote = await estimateWebsiteShippingFee({
      tenantId: tenant.id,
      weightKg: parsed.data.totalWeightKg,
      cityName: parsed.data.cityName,
      districtName: parsed.data.districtName,
    });
    return jsonWithCors(request, { success: true, data: { shippingFee: quote.shippingFee } }, { status: 200 });
  } catch (error) {
    console.error('POST /api/public/site/[tenantSlug]/shipping-quote error:', error);
    return errorWithCors(request, 500, 'An unexpected error occurred');
  }
}
