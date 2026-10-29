import type { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { forbidden, unauthorized } from '@/lib/api/error-envelope';
import type { PermissionKey } from '@/lib/constants/permissions';

/**
 * Auth + tenant + permission guard for the payment-account routes.
 *
 * The six payment-account endpoints (list, create, update, transfer, deposit,
 * close, book, cash-flow) all need the identical preamble. Extracting it keeps
 * each route file about the operation it performs, and guarantees the tenant
 * scoping can't be forgotten in one of them.
 */

export interface PaymentAccountRouteContext {
  ok: true;
  tenantId: string;
  userId: string;
  actorRole: string;
}

export interface PaymentAccountRouteFailure {
  ok: false;
  response: NextResponse;
}

export type PaymentAccountGuardResult = PaymentAccountRouteContext | PaymentAccountRouteFailure;

export async function requirePaymentAccountAuth(
  permission: PermissionKey,
): Promise<PaymentAccountGuardResult> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, response: unauthorized('Authentication required') };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { ok: false, response: unauthorized('No tenant associated') };
  }

  if (!hasPermission(session.user, permission)) {
    return {
      ok: false,
      response: forbidden('Insufficient permissions'),
    };
  }

  return {
    ok: true,
    tenantId,
    userId: session.user.id,
    actorRole: session.user.role,
  };
}
