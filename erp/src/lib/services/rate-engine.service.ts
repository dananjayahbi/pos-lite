import 'server-only';

import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { computeShippingFeeFromTerms } from '@/lib/delivery/shipping-rate.core';
import { MAX_RATE_WEIGHT_KG } from '@/lib/delivery/rateCardQuote.core';
import { computeCourierFeeBreakdown } from '@/lib/delivery/courier-fees.core';

/**
 * Local shipping-fee rate engine.
 * Trans Express provides no rate-estimation API, so fees are computed from a
 * per-tenant rate card (base + per-extra-kg, with optional zone overrides).
 *
 * Rules: fee = baseRate when weight <= freeBaseWeightKg, else
 *        fee = baseRate + ceil(weight - freeBaseWeightKg) * extraKgRate.
 *
 * The arithmetic itself lives in `shipping-rate.core.ts` (pure, unit tested);
 * this module only resolves the card and zone overrides from the database.
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
  /**
   * False when the tenant has no active rate card (ARGUS #292). `shippingFee` is
   * zero in that case, but callers must not treat it as free shipping.
   */
  configured: boolean;
}

export async function calculateShippingFee(input: RateCalcInput): Promise<RateCalcResult> {
  setSentryTenantContext({ tenantId: input.tenantId });

  // ARGUS #296: a 1,000,000 kg parcel produced a Rs 100,000,475.00 quote. The
  // limit is enforced server-side here so every caller (website quote, order
  // creation, ERP delivery) shares it.
  if (input.weightKg !== null && input.weightKg !== undefined) {
    const weight = Number(input.weightKg.toString());
    if (Number.isFinite(weight) && weight > MAX_RATE_WEIGHT_KG) {
      throw new Error('RATE_WEIGHT_EXCEEDED');
    }
  }

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
      configured: false,
    };
  }

  // Zone-specific override (city-level > district-level > card default).
  let baseRate = new Decimal(card.baseRate.toString());
  let extraKgRate = new Decimal(card.extraKgRate.toString());
  const freeBaseWeightKg = new Decimal(card.freeBaseWeightKg.toString());

  if (input.destinationCityId || input.destinationDistrictId) {
    // M25-01 (BUG-62): resolve precedence EXPLICITLY rather than relying on a
    // single findFirst with `orderBy: [{destinationCityId:'desc'}, ...]`.
    // Postgres puts NULLs FIRST for DESC, so a district-only row (city=null)
    // always sorted ahead of the exact city match and city rates never applied.
    // Three deterministic lookups encode the documented precedence:
    //   1) exact city (+ district when supplied)  2) district-only  3) card default
    //
    // ARGUS #290: every lookup requires originDistrictId = null. The data model
    // has no origin on a delivery, so legacy origin-specific rows must never
    // fall through as a global override.
    const override =
      (input.destinationCityId
        ? await prisma.rateCardEntry.findFirst({
            where: {
              tenantId: input.tenantId,
              rateCardId: card.id,
              originDistrictId: null,
              destinationCityId: input.destinationCityId,
            },
            // ARGUS #294: legacy duplicate rows must resolve deterministically.
            orderBy: { id: 'asc' },
          })
        : null) ??
      (input.destinationDistrictId
        ? await prisma.rateCardEntry.findFirst({
            where: {
              tenantId: input.tenantId,
              rateCardId: card.id,
              originDistrictId: null,
              destinationCityId: null,
              destinationDistrictId: input.destinationDistrictId,
            },
            orderBy: { id: 'asc' },
          })
        : null) ??
      (await prisma.rateCardEntry.findFirst({
        where: {
          tenantId: input.tenantId,
          rateCardId: card.id,
          originDistrictId: null,
          destinationCityId: null,
          destinationDistrictId: null,
        },
        orderBy: { id: 'asc' },
      }));

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

  return {
    ...computeShippingFeeFromTerms(weight, { baseRate, extraKgRate, freeBaseWeightKg }),
    configured: true,
  };
}

/**
 * Compute net payout for reconciliation (ARGUS #293):
 *
 *   commission = grossCOD x COD%
 *   VAT        = (deliveryFee + commission) x VAT%
 *   net        = grossCOD - deliveryFee - commission - VAT
 *
 * VAT is on the courier service, never on the cash collected. The pure
 * breakdown lives in `lib/delivery/courier-fees.core.ts`.
 */
export function computeNetPayout(input: {
  grossCod: Decimal | string | number;
  deliveryFee?: Decimal | string | number | null;
  coddCommissionPct?: Decimal | string | number | null;
  vatRatePct?: Decimal | string | number | null;
}): Decimal {
  return computeCourierFeeBreakdown({
    grossCod: input.grossCod,
    deliveryFee: input.deliveryFee ?? null,
    coddCommissionPct: input.coddCommissionPct ?? null,
    vatRatePct: input.vatRatePct ?? null,
  }).netPayout;
}
