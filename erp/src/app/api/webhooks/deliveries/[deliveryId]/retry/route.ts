import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deliverWebhook } from '@/lib/webhooks/send';
import { recordRetryOutcome } from '@/lib/webhooks/retry-schedule';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ deliveryId: string }> },
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

    // XC-03: shared manage key replaces the bare `role !== 'OWNER'` check.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebhookEndpoints);
    if (forbidden) return forbidden;

    const { deliveryId } = await params;

    const delivery = await prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        webhookEndpoint: { tenantId },
      },
      include: {
        webhookEndpoint: {
          select: {
            id: true,
            url: true,
            secret: true,
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook delivery not found' } },
        { status: 404 },
      );
    }

    const payload = typeof delivery.payload === 'object' && delivery.payload !== null && !Array.isArray(delivery.payload)
      ? (delivery.payload as Record<string, unknown>)
      : { value: delivery.payload };

    const retried = await deliverWebhook({
      webhookEndpointId: delivery.webhookEndpoint.id,
      url: delivery.webhookEndpoint.url,
      secret: delivery.webhookEndpoint.secret,
      event: delivery.event,
      payload,
      attempt: (delivery.attempt ?? 1) + 1,
      // M33-02 (OBS-62): a manual retry is itself a retry — it must NOT open a
      // second scheduled retry, otherwise the chain head and the cron sweep
      // would both drive the same event and duplicate deliveries.
      scheduleRetry: false,
    });

    // Keep the chain head's schedule truthful: a manual retry that SUCCEEDS
    // must cancel the pending automatic retry, and one that fails must push the
    // next attempt out rather than leaving a stale (already-past) nextRetryAt.
    await recordRetryOutcome(delivery.id, (delivery.attempt ?? 1) + 1, retried.status === 'SUCCESS');

    return NextResponse.json({
      success: true,
      data: {
        id: retried.id,
        status: retried.status,
        statusCode: retried.statusCode,
      },
    });
  } catch (error) {
    console.error('POST /api/webhooks/deliveries/[deliveryId]/retry error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retry webhook delivery' } },
      { status: 500 },
    );
  }
}
