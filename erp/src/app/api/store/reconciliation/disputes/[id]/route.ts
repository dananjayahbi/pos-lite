import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { updateDispute } from '@/lib/services/reconciliation-dispute.service';
import { DisputeStatus } from '@/generated/prisma/client';

/**
 * PATCH /api/store/reconciliation/disputes/[id] — update a dispute's status /
 * resolution as it progresses through OPEN → UNDER_REVIEW → ACCEPTED/REJECTED/CLOSED.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.importRemittance);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  if (!id) return validationError(null, 'A dispute id is required');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }
  const { status, resolutionNote } = (body ?? {}) as Record<string, unknown>;

  if (!status || !Object.values(DisputeStatus).includes(status as DisputeStatus)) {
    return validationError(null, 'A valid dispute status is required');
  }

  try {
    const dispute = await updateDispute({
      tenantId: guard.tenantId,
      disputeId: id,
      actorId: guard.userId,
      status: status as DisputeStatus,
      resolutionNote: typeof resolutionNote === 'string' ? resolutionNote : null,
    });
    return NextResponse.json({ success: true, data: dispute });
  } catch (error) {
    console.error('PATCH /api/store/reconciliation/disputes/[id] error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
