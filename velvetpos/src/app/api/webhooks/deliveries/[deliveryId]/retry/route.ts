import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deliverWebhook } from '@/lib/webhooks/send';

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

    if (session.user.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only owners can retry webhook deliveries' } },
        { status: 403 },
      );
    }

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
    });

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
