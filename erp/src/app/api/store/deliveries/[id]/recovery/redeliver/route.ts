import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { redeliverDelivery } from '@/lib/services/delivery-recovery.service';
import { RedeliverDeliverySchema } from '@/lib/validators/recovery.validators';
import type { RedeliverDeliveryInput } from '@/lib/validators/recovery.validators';

/** POST /api/store/deliveries/[id]/recovery/redeliver — re-push to courier. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageRecovery);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = RedeliverDeliverySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const delivery = await redeliverDelivery(guard.tenantId, id, guard.userId, parsed.data as RedeliverDeliveryInput);
    return NextResponse.json({ success: true, data: delivery });
  } catch (error) {
    console.error('POST /api/store/deliveries/[id]/recovery/redeliver error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
