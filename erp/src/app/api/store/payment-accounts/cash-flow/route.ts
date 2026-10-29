import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { getCashFlow } from '@/lib/services/paymentAccount.service';

export async function GET(request: Request) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') ?? 50) || 50));

    const result = await getCashFlow(guard.tenantId, {
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      accountId: searchParams.get('accountId') ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payment-accounts/cash-flow');
  }
}
