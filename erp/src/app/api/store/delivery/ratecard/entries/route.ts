import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { UpsertRateCardEntriesSchema } from '@/lib/validators/ratecard.validators';
import type { UpsertRateCardEntriesInput } from '@/lib/validators/ratecard.validators';

export async function PUT(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageRateCard);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = UpsertRateCardEntriesSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  const input = parsed.data as UpsertRateCardEntriesInput;

  const card = await prisma.rateCard.findFirst({ where: { tenantId: guard.tenantId, isActive: true } });
  if (!card) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'No active rate card exists' } },
      { status: 400 },
    );
  }

  try {
    const { entries } = input;

    // M25-03 (XC-06, BUG-64): the whole replace is ONE atomic transaction and
    // the parent card row is locked first, so two concurrent PUTs queue instead
    // of interleaving (delete+create in separate top-level calls used to blend
    // both writers' payloads into a matrix neither saved). Last write wins.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT id FROM "rate_cards" WHERE "id" = $1 FOR UPDATE', card.id);

      // Upsert: update existing entries (by id), create new ones.
      const ids = entries.filter((e) => e.id).map((e) => e.id) as string[];
      if (ids.length > 0) {
        await tx.rateCardEntry.deleteMany({
          where: { rateCardId: card.id, id: { notIn: ids } },
        });
      } else {
        await tx.rateCardEntry.deleteMany({ where: { rateCardId: card.id } });
      }

      for (const entry of entries) {
        const data = {
          originDistrictId: entry.originDistrictId ?? null,
          destinationDistrictId: entry.destinationDistrictId ?? null,
          destinationCityId: entry.destinationCityId ?? null,
          baseRate: entry.baseRate ?? null,
          extraKgRate: entry.extraKgRate ?? null,
        };
        if (entry.id) {
          const existing = await tx.rateCardEntry.findFirst({
            where: { id: entry.id, rateCardId: card.id },
          });
          if (existing) {
            await tx.rateCardEntry.update({ where: { id: entry.id }, data });
            continue;
          }
        }
        await tx.rateCardEntry.create({
          data: { ...data, tenantId: guard.tenantId, rateCardId: card.id },
        });
      }
    });

    void createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: 'UNKNOWN',
      entityType: 'RateCard',
      entityId: card.id,
      action: AUDIT_ACTIONS.RATE_CARD_UPDATED,
      after: { entries: entries.length },
    });

    const full = await prisma.rateCard.findUnique({ where: { id: card.id }, include: { entries: true } });
    return NextResponse.json({ success: true, data: full });
  } catch (error) {
    console.error('PUT /api/store/delivery/ratecard/entries error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
