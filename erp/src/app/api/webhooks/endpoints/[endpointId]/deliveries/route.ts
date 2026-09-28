import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseQueryInt as parseIntParamSafe } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpointId: string }> },
) {
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

    // XC-03: one guard, one key — replaces the local ALLOWED_ROLES set.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.viewWebhookEndpoints);
    if (forbidden) return forbidden;

    const { endpointId } = await params;
    // XC-01: malformed limit → typed 400 (was a silent `|| 15` fallback, which
    // masked a caller's mistake); out-of-range still clamps to [1, 50].
    const limit =
      parseIntParamSafe(request.nextUrl.searchParams, 'limit', { default: 15, min: 1, max: 50 }) ?? 15;

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } },
        { status: 404 },
      );
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookEndpointId: endpointId },
      orderBy: { attemptedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, data: deliveries });
  } catch (error) {
    // XC-01/XC-02: a malformed `limit` is a typed 400 via the shared envelope
    // handler, not a generic 500.
    return toErrorResponse(error, 'GET /api/webhooks/endpoints/[endpointId]/deliveries');
  }
}
