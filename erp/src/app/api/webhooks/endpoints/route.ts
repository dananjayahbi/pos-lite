import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateWebhookSecret } from '@/lib/webhooks/generate-secret';
import { zSafeUrl } from '@/lib/validators/shared';
import { parsePagination } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';

/** M33-02 (OBS-66): generous default so existing consumers are unaffected. */
const ENDPOINTS_DEFAULT_LIMIT = 50;
const ENDPOINTS_MAX_LIMIT = 200;

// XC-03: viewWebhookEndpoints / manageWebhookEndpoints replace the local
// ALLOWED_ROLES_READ set and the bare `role !== 'OWNER'` write check.

const KNOWN_EVENTS = [
  'sale.completed',
  'return.initiated',
  'stock.adjusted',
  'stock.low',
  'customer.created',
] as const;

const createEndpointSchema = z.object({
  // M33-01 (BUG-76): the field used to accept any syntactically-valid URL, so
  // `https://evil.example.com/<script>alert(1)</script>` was stored verbatim
  // and echoed by the list API. `zSafeUrl` (XC-04) rejects the RFC-3986-illegal
  // characters that build markup / attribute breakouts, so such input is a typed
  // 400 instead of a stored payload.
  url: zSafeUrl().refine((u) => u.startsWith('https://'), {
    message: 'Webhook URL must use HTTPS',
  }),
  events: z
    .array(z.enum(KNOWN_EVENTS))
    .min(1, 'At least one event is required'),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    // XC-03: shared view key replaces the local ALLOWED_ROLES_READ set.
    const readForbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.viewWebhookEndpoints);
    if (readForbidden) return readForbidden;
    // M33-02 (OBS-66): the list was unbounded. Page/limit go through the shared
    // XC-01 parsers (malformed → typed 400, out-of-range → clamped) with a
    // generous default of 50 so existing consumers see no change.
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams, {
      defaultLimit: ENDPOINTS_DEFAULT_LIMIT,
      maxLimit: ENDPOINTS_MAX_LIMIT,
    });
    const skip = (page - 1) * limit;

    const where = { tenantId, deletedAt: null };

    const [endpoints, total] = await Promise.all([
      prisma.webhookEndpoint.findMany({
        where,
        select: {
          id: true,
          url: true,
          isActive: true,
          events: true,
          createdAt: true,
          deliveries: {
            orderBy: { attemptedAt: 'desc' },
            take: 1,
            select: {
              status: true,
              statusCode: true,
              attemptedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.webhookEndpoint.count({ where }),
    ]);

    const data = endpoints.map((ep) => ({
      id: ep.id,
      url: ep.url,
      isActive: ep.isActive,
      events: ep.events,
      createdAt: ep.createdAt,
      lastDelivery: ep.deliveries[0] ?? null,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: { page, limit, total, hasMore: skip + endpoints.length < total },
    });
  } catch (error) {
    // M33-02 / XC-01: `parsePagination` throws a typed `ApiError` for a
    // malformed page/limit. Routing it through the shared envelope handler is
    // what makes that a 400 BAD_REQUEST instead of a generic 500.
    return toErrorResponse(error, 'GET /api/webhooks/endpoints');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    // XC-03: shared manage key replaces the bare `role !== 'OWNER'` check.
    const writeForbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebhookEndpoints);
    if (writeForbidden) return writeForbidden;

    const body: unknown = await request.json();
    const parsed = createEndpointSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const secret = generateWebhookSecret();

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url: parsed.data.url,
        secret,
        events: parsed.data.events,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: endpoint.id,
          url: endpoint.url,
          secret: endpoint.secret,
          isActive: endpoint.isActive,
          events: endpoint.events,
          createdAt: endpoint.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/webhooks/endpoints error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook endpoint' } },
      { status: 500 },
    );
  }
}
