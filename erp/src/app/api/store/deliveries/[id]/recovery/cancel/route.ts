import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { permanentlyCancelDelivery } from '@/lib/services/delivery-recovery.service';
import { PermanentCancelDeliverySchema } from '@/lib/validators/recovery.validators';
import type { PermanentCancelDeliveryInput } from '@/lib/validators/recovery.validators';

/** POST /api/store/deliveries/[id]/recovery/cancel — permanent cancel + reversal. */
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

  const parsed = PermanentCancelDeliverySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const delivery = await permanentlyCancelDelivery(
      guard.tenantId,
      id,
      guard.userId,
      parsed.data as PermanentCancelDeliveryInput,
    );
    return NextResponse.json({ success: true, data: delivery });
  } catch (error) {
    console.error('POST /api/store/deliveries/[id]/recovery/cancel error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
