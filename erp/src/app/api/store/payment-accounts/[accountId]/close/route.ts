import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { CloseAccountSchema } from '@/lib/validators/paymentAccount.validators';
import { closePaymentAccount } from '@/lib/services/paymentAccount.service';

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.closePaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const { accountId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = CloseAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const account = await closePaymentAccount(
      guard.tenantId,
      guard.userId,
      guard.actorRole,
      accountId,
      parsed.data,
    );

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/payment-accounts/[accountId]/close');
  }
}
