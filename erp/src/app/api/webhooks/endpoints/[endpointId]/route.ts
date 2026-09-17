import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { PERMISSIONS } from '@/lib/constants/permissions';

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

    // XC-03: shared manage key replaces the bare `role !== 'OWNER'` check.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.SETTINGS.manageWebhookEndpoints);
    if (forbidden) return forbidden;

    const { endpointId } = await params;

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId, deletedAt: null },
    });

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } },
        { status: 404 },
      );
    }

    // M33-03 (OBS-63) / XC-05: this used to be a hard delete, and
    // `WebhookDelivery.webhookEndpoint` cascades on delete — removing an
    // endpoint silently destroyed its whole delivery ledger. "Delete" now
    // follows the app's soft-delete convention: the endpoint is hidden from the
    // list while the delivery history survives for audit.
    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true, data: { id: endpointId, deleted: true } });
  } catch (error) {
    console.error('DELETE /api/webhooks/endpoints/[endpointId] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook endpoint' } },
      { status: 500 },
    );
  }
}
