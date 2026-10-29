import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { WithdrawalSchema } from '@/lib/validators/paymentAccount.validators';
import { withdrawFunds } from '@/lib/services/paymentAccount.service';

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.depositFunds);
  if (!guard.ok) return guard.response;

  try {
    const { accountId } = await params;
    const body = await request.json();
    const parsed = WithdrawalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const result = await withdrawFunds(
      guard.tenantId,
      guard.userId,
      guard.actorRole,
      accountId,
      parsed.data,
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/payment-accounts/[accountId]/withdraw');
  }
}
