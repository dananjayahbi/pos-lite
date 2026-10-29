import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { UpdatePaymentAccountSchema } from '@/lib/validators/paymentAccount.validators';
import { getPaymentAccount, updatePaymentAccount } from '@/lib/services/paymentAccount.service';

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const { accountId } = await params;
    const account = await getPaymentAccount(guard.tenantId, accountId);
    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payment-accounts/[accountId]');
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.managePaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const { accountId } = await params;
    const body = await request.json();
    const parsed = UpdatePaymentAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const account = await updatePaymentAccount(
      guard.tenantId,
      guard.userId,
      guard.actorRole,
      accountId,
      parsed.data,
    );

    return NextResponse.json({ success: true, data: account });
  } catch (error) {
    return toErrorResponse(error, 'PATCH /api/store/payment-accounts/[accountId]');
  }
}
