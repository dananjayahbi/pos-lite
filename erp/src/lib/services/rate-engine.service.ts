import 'server-only';

import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';

/**
 * Local shipping-fee rate engine.
 * Trans Express provides no rate-estimation API, so fees are computed from a
 * per-tenant rate card (base + per-extra-kg, with optional zone overrides).
 *
 * Rules: fee = baseRate when weight <= freeBaseWeightKg, else
 *        fee = baseRate + ceil(weight - freeBaseWeightKg) * extraKgRate.
 */

export interface RateCalcInput {
  tenantId: string;
  weightKg?: Decimal | string | number | null | undefined;
  destinationDistrictId?: number | null | undefined;
  destinationCityId?: number | null | undefined;
}

export interface RateCalcResult {
  shippingFee: Decimal;
  baseRate: Decimal;
  extraKgRate: Decimal;
  extraKg: Decimal;
  freeBaseWeightKg: Decimal;
}

export async function calculateShippingFee(input: RateCalcInput): Promise<RateCalcResult> {
  setSentryTenantContext({ tenantId: input.tenantId });

  const card = await prisma.rateCard.findFirst({
    where: { tenantId: input.tenantId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  const defaultCard = {
    baseRate: new Decimal(0),
    extraKgRate: new Decimal(0),
    freeBaseWeightKg: new Decimal(1),
  };

  if (!card) {
    return {
      shippingFee: new Decimal(0),
      ...defaultCard,
      extraKg: new Decimal(0),
    };
  }

  // Zone-specific override (city-level > district-level > card default).
  let baseRate = new Decimal(card.baseRate.toString());
  let extraKgRate = new Decimal(card.extraKgRate.toString());
  const freeBaseWeightKg = new Decimal(card.freeBaseWeightKg.toString());

  if (input.destinationCityId || input.destinationDistrictId) {
    const override = await prisma.rateCardEntry.findFirst({
      where: {
        tenantId: input.tenantId,
        rateCardId: card.id,
        OR: [
          ...(input.destinationCityId ? [{ destinationCityId: input.destinationCityId }] : []),
          ...(input.destinationDistrictId
            ? [{ destinationCityId: null, destinationDistrictId: input.destinationDistrictId }]
            : []),
          { destinationCityId: null, destinationDistrictId: null },
        ],
      },
      orderBy: [{ destinationCityId: 'desc' }, { destinationDistrictId: 'desc' }],
    });

    if (override) {
      if (override.baseRate !== null && override.baseRate !== undefined) {
        baseRate = new Decimal(override.baseRate.toString());
      }
      if (override.extraKgRate !== null && override.extraKgRate !== undefined) {
        extraKgRate = new Decimal(override.extraKgRate.toString());
      }
    }
  }

  const weight = input.weightKg === null || input.weightKg === undefined
    ? new Decimal(0)
    : new Decimal(input.weightKg.toString());

  if (weight.lessThanOrEqualTo(freeBaseWeightKg)) {
    return { shippingFee: baseRate, baseRate, extraKgRate, extraKg: new Decimal(0), freeBaseWeightKg };
  }

  const extraKg = weight.minus(freeBaseWeightKg).ceil();
  const shippingFee = baseRate.plus(extraKg.times(extraKgRate));

  return { shippingFee, baseRate, extraKgRate, extraKg, freeBaseWeightKg };
}

/** Compute net payout for reconciliation: Net = GrossCOD − (fee + COD% + VAT%). */
export function computeNetPayout(input: {
  grossCod: Decimal | string | number;
  deliveryFee?: Decimal | string | number | null;
  coddCommissionPct?: Decimal | string | number | null;
  vatRatePct?: Decimal | string | number | null;
}): Decimal {
  const gross = new Decimal(input.grossCod.toString());
  const fee = input.deliveryFee ? new Decimal(input.deliveryFee.toString()) : new Decimal(0);
  const codPct = input.coddCommissionPct ? new Decimal(input.coddCommissionPct.toString()).div(100) : new Decimal(0);
  const vatPct = input.vatRatePct ? new Decimal(input.vatRatePct.toString()).div(100) : new Decimal(0);

  const deductions = fee.plus(gross.times(codPct)).plus(gross.times(vatPct));
  return gross.minus(deductions).toDecimalPlaces(2);
}
