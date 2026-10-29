import { NextResponse } from 'next/server';

import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { requirePaymentAccountAuth } from '@/lib/api/payment-account-guard';
import { CreatePaymentAccountSchema, PaymentAccountListQuerySchema } from '@/lib/validators/paymentAccount.validators';
import { createPaymentAccount, listPaymentAccounts } from '@/lib/services/paymentAccount.service';

export async function GET(request: Request) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.viewPaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = PaymentAccountListQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      search: searchParams.get('search') ?? undefined,
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

    const result = await listPaymentAccounts(guard.tenantId, parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/payment-accounts');
  }
}

export async function POST(request: Request) {
  const guard = await requirePaymentAccountAuth(PERMISSIONS.PAYMENT_ACCOUNT.managePaymentAccount);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const parsed = CreatePaymentAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const account = await createPaymentAccount(
      guard.tenantId,
      guard.userId,
      guard.actorRole,
      parsed.data,
    );

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/payment-accounts');
  }
}
