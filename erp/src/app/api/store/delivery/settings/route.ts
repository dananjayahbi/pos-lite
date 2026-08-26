import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { CourierSettingsSchema } from '@/lib/validators/courier.validators';
import type { CourierSettingsInput } from '@/lib/validators/courier.validators';

function redact(account: unknown): Record<string, unknown> {
  if (!account || typeof account !== 'object') return {};
  const { password, apiKey, ...rest } = account as Record<string, unknown>;
  return {
    ...rest,
    password: password ? '••••••••' : undefined,
    apiKey: apiKey ? '••••••••' : undefined,
  };
}

export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageCourierSettings);
  if (!guard.ok) return guard.response;

  const account = await prisma.courierAccount.findFirst({ where: { tenantId: guard.tenantId } });
  return NextResponse.json({ success: true, data: redact(account) });
}

export async function PUT(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageCourierSettings);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = CourierSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const input = parsed.data as CourierSettingsInput;
    const existing = await prisma.courierAccount.findFirst({ where: { tenantId: guard.tenantId } });

    const data: Record<string, unknown> = {
      env: input.env,
      isActive: input.isActive ?? false,
    };
    if (input.email) data.email = input.email;
    if (input.password) data.password = input.password;
    if (input.apiKey) data.apiKey = input.apiKey;
    if (input.originDistrictId !== undefined) data.originDistrictId = input.originDistrictId;
    if (input.originCityId !== undefined) data.originCityId = input.originCityId;
    if (input.pickupAddress !== undefined) data.pickupAddress = input.pickupAddress;

    const account = existing
      ? await prisma.courierAccount.update({ where: { id: existing.id }, data })
      : await prisma.courierAccount.create({ data: { tenantId: guard.tenantId, ...data } as never });

    void createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: 'UNKNOWN',
      entityType: 'CourierAccount',
      entityId: account.id,
      action: AUDIT_ACTIONS.COURIER_SETTINGS_UPDATED,
    });

    return NextResponse.json({ success: true, data: redact(account) });
  } catch (error) {
    console.error('PUT /api/store/delivery/settings error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
