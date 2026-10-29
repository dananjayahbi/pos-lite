import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import {
  AccountBookQuerySchema,
} from '@/lib/validators/paymentAccount.validators';
import { getAccountBook } from '@/lib/services/paymentAccount.service';

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const { accountId } = await params;
    const { searchParams } = new URL(request.url);

    const parsed = AccountBookQuerySchema.safeParse({
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      source: searchParams.get('source') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid filters', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const book = await getAccountBook(guard.tenantId, accountId, parsed.data);
    return NextResponse.json({ success: true, data: book });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payment-accounts/[accountId]/book');
  }
}
