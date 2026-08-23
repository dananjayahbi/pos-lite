import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  listDisputes,
  openDispute,
} from '@/lib/services/reconciliation-dispute.service';

/**
 * GET /api/store/reconciliation/disputes — list disputes (optional ?status=).
 * POST /api/store/reconciliation/disputes — open a dispute for a ledger entry.
 */
export async function GET(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewReconciliation);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const items = await listDisputes(guard.tenantId, status as never);
  return NextResponse.json({ success: true, data: items });
}

export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.importRemittance);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }
  const { ledgerEntryId, reason, disputedAmount } = (body ?? {}) as Record<string, unknown>;

  if (!ledgerEntryId || typeof ledgerEntryId !== 'string') {
    return validationError(null, 'A ledger entry id is required');
  }
  if (!reason || typeof reason !== 'string' || reason.length > 1000) {
    return validationError(null, 'A dispute reason is required (max 1000 chars)');
  }
  const amount = Number(disputedAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    return validationError(null, 'A valid disputed amount is required');
  }

  try {
    const dispute = await openDispute({
      tenantId: guard.tenantId,
      ledgerEntryId,
      openedById: guard.userId,
      reason,
      disputedAmount: amount,
    });
    return NextResponse.json({ success: true, data: dispute }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/reconciliation/disputes error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
