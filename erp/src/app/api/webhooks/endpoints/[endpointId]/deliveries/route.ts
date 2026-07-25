import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_ROLES = new Set(['OWNER', 'MANAGER']);

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

    if (!ALLOWED_ROLES.has(session.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { endpointId } = await params;
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? '15') || 15, 1), 50);

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId },
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
    console.error('GET /api/webhooks/endpoints/[endpointId]/deliveries error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhook deliveries' } },
      { status: 500 },
    );
  }
}
