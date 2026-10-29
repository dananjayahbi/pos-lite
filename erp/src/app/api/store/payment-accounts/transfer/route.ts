import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { FundTransferSchema } from '@/lib/validators/paymentAccount.validators';
import { transferFunds } from '@/lib/services/paymentAccount.service';

export async function POST(request: Request) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.transferFunds);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const parsed = FundTransferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const result = await transferFunds(guard.tenantId, guard.userId, guard.actorRole, parsed.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/payment-accounts/transfer');
  }
}
