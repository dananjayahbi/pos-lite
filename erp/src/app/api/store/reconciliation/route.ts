import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getLedgerEntries, getPendingCodAging } from '@/lib/services/reconciliation.service';
import { getAuditReport } from '@/lib/services/reconciliation-finance.service';
import { getOpenDisputeCount } from '@/lib/services/reconciliation-dispute.service';
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

  const [data, aging, audit, openDisputes] = await Promise.all([
    getLedgerEntries(guard.tenantId, parsed.data),
    getPendingCodAging(guard.tenantId),
    getAuditReport(guard.tenantId),
    getOpenDisputeCount(guard.tenantId),
  ]);
  return NextResponse.json({
    success: true,
    data: { ...data, aging, audit, openDisputes },
  });
}
