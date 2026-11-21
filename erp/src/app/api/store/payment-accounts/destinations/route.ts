import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { listPaymentAccountDestinations } from '@/lib/services/paymentAccount.service';

/**
 * Safe destination list for POS / expense pickers (ARGUS #427).
 * `payment_account:view` is enough here; balances and ledger entries are never
 * returned. The management list lives behind `payment_account:manage`.
 */
export async function GET() {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const result = await listPaymentAccountDestinations(guard.tenantId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payment-accounts/destinations');
  }
}
