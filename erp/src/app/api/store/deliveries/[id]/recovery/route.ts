import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { logRecoveryAction, getRecoveryAttempts } from '@/lib/services/delivery-recovery.service';
import { LogRecoveryActionSchema } from '@/lib/validators/recovery.validators';
import type { LogRecoveryActionInput } from '@/lib/validators/recovery.validators';

/** GET /api/store/deliveries/[id]/recovery — list recovery attempts. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewDelivery);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    const attempts = await getRecoveryAttempts(guard.tenantId, id);
    return NextResponse.json({ success: true, data: attempts });
  } catch (error) {
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/store/deliveries/[id]/recovery — log a non-destructive recovery
 * action (follow-up call or reschedule).
 */
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

  const parsed = LogRecoveryActionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const attempts = await logRecoveryAction(guard.tenantId, id, guard.userId, parsed.data as LogRecoveryActionInput);
    return NextResponse.json({ success: true, data: attempts });
  } catch (error) {
    console.error('POST /api/store/deliveries/[id]/recovery error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
