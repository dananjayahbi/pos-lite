/**
 * POST /api/public/site/[tenantSlug]/orders
 *
 * Public order placement from the website checkout. Creates a `Delivery`
 * (source = WEBSITE_CHECKOUT, status = PLACED) + shipping address so the order
 * appears immediately in the ERP Orders page. No auth — CORS-enabled, tenant
 * resolved by slug, delivery module gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';
import { isModuleEnabled } from '@/lib/feature-guard';
import { createWebsiteOrder } from '@/lib/services/order.service';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { WebsiteCheckoutSchema } from '@/lib/validators/checkout.validators';

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

  const parsed = WebsiteCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return jsonWithCors(request, { success: false, error: 'Validation failed', details: errors }, { status: 422 });
  }

  try {
    const result = await createWebsiteOrder(tenant.id, parsed.data);

    // Purge the storefront's product/catalog caches so availability & any
    // stock-derived data reflects the new order. Best-effort — never fail
    // the order placement if revalidation is unavailable.
    try {
      await revalidateTenantStorefront(tenant.id, { catalog: true });
    } catch (revalidateErr) {
      console.warn('[POST /api/public/site/[tenantSlug]/orders] Revalidation warning:', revalidateErr);
    }

    return jsonWithCors(request, { success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('POST /api/public/site/[tenantSlug]/orders error:', error);
    return errorWithCors(request, 500, 'An unexpected error occurred');
  }
}
