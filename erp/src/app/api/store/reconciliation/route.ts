import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getLedgerEntries, getPendingCodAging } from '@/lib/services/reconciliation.service';
import { ReconciliationFiltersSchema } from '@/lib/validators/reconciliation.validators';

export async function GET(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewReconciliation);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = ReconciliationFiltersSchema.safeParse(params);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Invalid filter parameters');
  }

  const data = await getLedgerEntries(guard.tenantId, parsed.data);
  const aging = await getPendingCodAging(guard.tenantId);
  return NextResponse.json({ success: true, data: { ...data, aging } });
}
