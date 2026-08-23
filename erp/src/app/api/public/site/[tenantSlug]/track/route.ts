/**
 * GET /api/public/site/[tenantSlug]/track
 *
 * Public, read-only order-tracking lookup. Accepts a lookup key — order
 * reference (`ref`), customer phone (`phone`) or courier waybill (`waybill`)
 * — and returns a customer-safe summary of matching website orders with their
 * delivery timeline. Never returns raw courier enum values.
 *
 * Simple in-memory per-IP rate limiting guards against abuse. Caches briefly
 * on the edge.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';
import { getPublicTracking } from '@/lib/services/tracking-public.service';

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

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
  const { tenantSlug } = await context.params;

  if (!tenantSlug || tenantSlug.length > 64) {
    return errorWithCors(request, 400, 'Invalid tenant slug');
  }

  // Rate-limit by client IP.
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

  const url = new URL(request.url);
  const ref = url.searchParams.get('ref') ?? undefined;
  const phone = url.searchParams.get('phone') ?? undefined;
  const waybill = url.searchParams.get('waybill') ?? undefined;

  if (!ref && !phone && !waybill) {
    return errorWithCors(request, 400, 'Provide a reference, phone or waybill');
  }

  const orders = await getPublicTracking(tenant.id, {
    orderRef: ref,
    phone,
    waybill,
  });

  return jsonWithCors(
    request,
    { orders },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
