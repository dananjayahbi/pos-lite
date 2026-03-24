import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deliverWebhook } from '@/lib/webhooks/send';

export async function POST(
  _request: Request,
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

    if (session.user.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only owners can test webhook endpoints' } },
        { status: 403 },
      );
    }

    const { endpointId } = await params;

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId },
    });

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } },
        { status: 404 },
      );
    }

    const event = 'test.ping';
    const payload = { message: 'Test webhook delivery', timestamp: new Date().toISOString() };
    const delivery = await deliverWebhook({
      webhookEndpointId: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
      event,
      payload,
    });

    return NextResponse.json({
      success: true,
      data: {
        deliveryId: delivery.id,
        status: delivery.status,
        statusCode: delivery.statusCode,
        attemptedAt: delivery.attemptedAt,
      },
    });
  } catch (error) {
    console.error('POST /api/webhooks/endpoints/[endpointId]/test error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to test webhook endpoint' } },
      { status: 500 },
    );
  }
}
