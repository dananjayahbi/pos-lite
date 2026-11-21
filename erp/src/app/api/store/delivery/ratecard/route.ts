import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { getRateCardMeta, recordRateCardMeta } from '@/lib/services/rate-card-meta.service';
import { UpsertRateCardSchema } from '@/lib/validators/ratecard.validators';
import type { UpsertRateCardInput } from '@/lib/validators/ratecard.validators';

export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageRateCard);
  if (!guard.ok) return guard.response;

  const card = await prisma.rateCard.findFirst({
    where: { tenantId: guard.tenantId, isActive: true },
    include: { entries: true },
    orderBy: { updatedAt: 'desc' },
  });
  const rateCardMeta = await getRateCardMeta(guard.tenantId);
  return NextResponse.json({
    success: true,
    data: card ?? null,
    // ARGUS #295: last change provenance for the financial master record.
    meta: { rateCardMeta },
  });
}

export async function PUT(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageRateCard);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = UpsertRateCardSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const input = parsed.data as UpsertRateCardInput;
    let card = await prisma.rateCard.findFirst({ where: { tenantId: guard.tenantId, isActive: true } });
    // ARGUS #295: snapshot the values being replaced for the audit trail.
    const before = card
      ? {
          name: card.name,
          baseRate: card.baseRate.toString(),
          extraKgRate: card.extraKgRate.toString(),
          freeBaseWeightKg: card.freeBaseWeightKg.toString(),
          coddCommissionPct: card.coddCommissionPct?.toString() ?? null,
          vatRatePct: card.vatRatePct?.toString() ?? null,
        }
      : null;

    if (!card) {
      card = await prisma.rateCard.create({
        data: {
          tenantId: guard.tenantId,
          name: input.name ?? 'Trans Express Standard',
          baseRate: input.baseRate ?? 0,
          extraKgRate: input.extraKgRate ?? 0,
          freeBaseWeightKg: input.freeBaseWeightKg ?? 1,
          ...(input.coddCommissionPct !== undefined ? { coddCommissionPct: input.coddCommissionPct } : {}),
          ...(input.vatRatePct !== undefined ? { vatRatePct: input.vatRatePct } : {}),
          isActive: true,
        },
      });
    } else {
      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.baseRate !== undefined) data.baseRate = input.baseRate;
      if (input.extraKgRate !== undefined) data.extraKgRate = input.extraKgRate;
      if (input.freeBaseWeightKg !== undefined) data.freeBaseWeightKg = input.freeBaseWeightKg;
      if (input.coddCommissionPct !== undefined) data.coddCommissionPct = input.coddCommissionPct;
      if (input.vatRatePct !== undefined) data.vatRatePct = input.vatRatePct;
      card = await prisma.rateCard.update({
        where: { id: card.id },
        data: data as never,
      });
    }

    await recordRateCardMeta(
      guard.tenantId,
      { id: guard.userId, email: guard.email, role: guard.role },
      'card',
    );

    await createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: guard.role,
      entityType: 'RateCard',
      entityId: card.id,
      action: AUDIT_ACTIONS.RATE_CARD_UPDATED,
      before,
      after: {
        name: card.name,
        baseRate: card.baseRate.toString(),
        extraKgRate: card.extraKgRate.toString(),
        freeBaseWeightKg: card.freeBaseWeightKg.toString(),
        coddCommissionPct: card.coddCommissionPct?.toString() ?? null,
        vatRatePct: card.vatRatePct?.toString() ?? null,
      },
    });

    const full = await prisma.rateCard.findUnique({ where: { id: card.id }, include: { entries: true } });
    return NextResponse.json({ success: true, data: full });
  } catch (error) {
    console.error('PUT /api/store/delivery/ratecard error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
