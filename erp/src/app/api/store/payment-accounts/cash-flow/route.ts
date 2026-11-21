import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { getCashFlow } from '@/lib/services/paymentAccount.service';
import { validateCashFlowRange } from '@/lib/reports/cashflowRange';

export async function GET(request: Request) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.managePaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);

    // ARGUS #422: reject a reversed window instead of returning an empty page.
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');
    if (dateFromParam && dateToParam) {
      const validation = validateCashFlowRange(dateFromParam, dateToParam);
      if (!validation.ok) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: validation.message },
          },
          { status: 400 },
        );
      }
    }

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
