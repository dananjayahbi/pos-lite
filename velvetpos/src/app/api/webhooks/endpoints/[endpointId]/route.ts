import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Only owners can delete webhook endpoints' } },
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

    await prisma.webhookEndpoint.delete({ where: { id: endpointId } });

    return NextResponse.json({ success: true, data: { id: endpointId } });
  } catch (error) {
    console.error('DELETE /api/webhooks/endpoints/[endpointId] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook endpoint' } },
      { status: 500 },
    );
  }
}
