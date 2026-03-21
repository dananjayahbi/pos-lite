import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

    const signature = createHmac('sha256', endpoint.secret)
      .update(body)
      .digest('hex');

    let status: 'SUCCESS' | 'FAILED' = 'FAILED';
    let statusCode: number | null = null;
    let responseText: string | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      statusCode = res.status;
      responseText = await res.text().catch(() => null);
      status = res.ok ? 'SUCCESS' : 'FAILED';
    } catch (err) {
      responseText = err instanceof Error ? err.message : 'Unknown error';
    }

    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: endpoint.id,
        event,
        payload: payload as object,
        statusCode,
        response: responseText?.slice(0, 1000) ?? null,
        status,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        deliveryId: delivery.id,
        status: delivery.status,
        statusCode: delivery.statusCode,
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
