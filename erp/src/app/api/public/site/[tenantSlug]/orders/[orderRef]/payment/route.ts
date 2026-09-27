/**
 * GET /api/public/site/[tenantSlug]/orders/[orderRef]/payment
 *
 * Public, read-only payment status for one website order, looked up by its
 * order reference. PayHere's `return_url` carries NO payment status, so the
 * storefront confirmation page reads the authoritative state from here after
 * the browser comes back from the gateway.
 *
 * Customer-safe by design: no internal ids, no tenant id, no gateway signature.
 * The reference is scoped by tenant, so one storefront cannot read another
 * tenant's order. Rate-limited per IP like the public tracking endpoint.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';
import { getPublicOrderPayment } from '@/lib/services/order-payment-public.service';

interface RouteContext {
  params: Promise<{ tenantSlug: string; orderRef: string }>;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 40;

const hitCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hitCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    hitCounts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { tenantSlug, orderRef } = await context.params;

  if (!tenantSlug || tenantSlug.length > 64) {
    return errorWithCors(request, 400, 'Invalid tenant slug');
  }
  if (!orderRef || orderRef.length > 64) {
    return errorWithCors(request, 400, 'Invalid order reference');
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  if (rateLimited(`${tenantSlug}:${ip}`)) {
    return errorWithCors(request, 429, 'Too many requests');
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

  const order = await getPublicOrderPayment(tenant.id, decodeURIComponent(orderRef));
  if (!order) {
    return errorWithCors(request, 404, 'Order not found');
  }

  return jsonWithCors(request, { order }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
