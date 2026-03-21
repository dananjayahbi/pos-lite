import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import type { PromotionType } from '@/generated/prisma/client';
import type { CreatePromotionInput, UpdatePromotionInput } from '@/lib/validators/promotion.validators';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CartLine {
  variantId: string;
  quantity: number;
  unitPrice: string;
  manualDiscountAmount?: string | undefined;
  categoryId?: string | undefined;
}

export interface AppliedDiscount {
  promotionId: string;
  label: string;
  discountAmount: string;
  promotionType: string;
  affectedLines: string[];
}

export interface SkippedPromotion {
  promotionId: string;
  reason: string;
}

export interface EvaluationResult {
  appliedDiscounts: AppliedDiscount[];
  skippedPromotions: SkippedPromotion[];
  totalDiscountAmount: string;
}

interface GroupedPromotions {
  CART_PERCENTAGE: PromotionRow[];
  CART_FIXED: PromotionRow[];
  CATEGORY_PERCENTAGE: PromotionRow[];
  BOGO: PromotionRow[];
  MIX_AND_MATCH: PromotionRow[];
  PROMO_CODE: PromotionRow[];
}

interface PromotionRow {
  id: string;
  name: string;
  type: PromotionType;
  value: { toString(): string }; // Prisma Decimal
  promoCode: string | null;
  targetCategoryId: string | null;
  minQuantity: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  description: string | null;
}

// ── Fetch Active Promotions ──────────────────────────────────────────────────

export async function fetchActivePromotions(tenantId: string): Promise<GroupedPromotions> {
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { startsAt: null, endsAt: null },
        { startsAt: { lte: now }, endsAt: null },
        { startsAt: null, endsAt: { gte: now } },
        { startsAt: { lte: now }, endsAt: { gte: now } },
      ],
    },
  });

  const grouped: GroupedPromotions = {
    CART_PERCENTAGE: [],
    CART_FIXED: [],
    CATEGORY_PERCENTAGE: [],
    BOGO: [],
    MIX_AND_MATCH: [],
    PROMO_CODE: [],
  };

  for (const p of promos) {
    const row = p as unknown as PromotionRow;
    if (row.type in grouped) {
      grouped[row.type].push(row);
    }
  }

  return grouped;
}

// ── Evaluate Customer Pricing ────────────────────────────────────────────────

export async function evaluateCustomerPricing(
  tenantId: string,
  cartLines: CartLine[],
  customerId?: string | undefined,
): Promise<AppliedDiscount[]> {
  if (!customerId) return [];

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { tags: true },
  });
  if (!customer || customer.tags.length === 0) return [];

  const variantIds = cartLines.map((l) => l.variantId);
  const rules = await prisma.customerPricingRule.findMany({
    where: {
      tenantId,
      isActive: true,
      customerTag: { in: customer.tags },
      OR: [
        { variantId: { in: variantIds } },
        { variantId: null },
      ],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
      ],
    },
  });

  if (rules.length === 0) return [];

  const discounts: AppliedDiscount[] = [];

  for (const line of cartLines) {
    const matchingRules = rules.filter(
      (r) => r.variantId === line.variantId || r.variantId === null,
    );
    if (matchingRules.length === 0) continue;

    // Pick rule with lowest price (best for customer)
    const bestRule = matchingRules.reduce((best, r) =>
      new Decimal(r.price.toString()).lessThan(new Decimal(best.price.toString())) ? r : best,
    );

    const rulePrice = new Decimal(bestRule.price.toString());
    const unitPrice = new Decimal(line.unitPrice);
    if (rulePrice.greaterThanOrEqualTo(unitPrice)) continue;

    const perUnitDiscount = unitPrice.minus(rulePrice);
    const totalDiscount = perUnitDiscount.times(line.quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    discounts.push({
      promotionId: bestRule.id,
      label: `Customer pricing: ${bestRule.customerTag}`,
      discountAmount: totalDiscount.toString(),
      promotionType: 'CUSTOMER_PRICING',
      affectedLines: [line.variantId],
    });
  }

  return discounts;
}

// ── Evaluate Category Discounts ──────────────────────────────────────────────

export function evaluateCategoryDiscounts(
  cartLines: CartLine[],
  promos: PromotionRow[],
  alreadyDiscounted: Set<string>,
): { applied: AppliedDiscount[]; skipped: SkippedPromotion[] } {
  const applied: AppliedDiscount[] = [];
  const skipped: SkippedPromotion[] = [];

  for (const promo of promos) {
    if (!promo.targetCategoryId) {
      skipped.push({ promotionId: promo.id, reason: 'No target category set' });
      continue;
    }

    const matchingLines = cartLines.filter(
      (l) => l.categoryId === promo.targetCategoryId && !alreadyDiscounted.has(l.variantId),
    );

    if (matchingLines.length === 0) {
      skipped.push({ promotionId: promo.id, reason: 'No matching items in cart' });
      continue;
    }

    const value = new Decimal(promo.value.toString());
    let totalDiscount = new Decimal(0);
    const affectedLines: string[] = [];

    for (const line of matchingLines) {
      const lineTotal = new Decimal(line.unitPrice).times(line.quantity);
      const manualDisc = line.manualDiscountAmount ? new Decimal(line.manualDiscountAmount) : new Decimal(0);
      const afterManual = lineTotal.minus(manualDisc);
      const disc = afterManual.times(value).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalDiscount = totalDiscount.plus(disc);
      affectedLines.push(line.variantId);
      alreadyDiscounted.add(line.variantId);
    }

    applied.push({
      promotionId: promo.id,
      label: `${promo.name} — ${value.toString()}% off category`,
      discountAmount: totalDiscount.toString(),
      promotionType: 'CATEGORY_PERCENTAGE',
      affectedLines,
    });
  }

  return { applied, skipped };
}

// ── Evaluate BOGO / Mix & Match ──────────────────────────────────────────────

export function evaluateBOGO(
  cartLines: CartLine[],
  promos: PromotionRow[],
  alreadyDiscounted: Set<string>,
): { applied: AppliedDiscount[]; skipped: SkippedPromotion[] } {
  const applied: AppliedDiscount[] = [];
  const skipped: SkippedPromotion[] = [];

  for (const promo of promos) {
    const minQty = promo.minQuantity ?? 2;

    const eligibleLines = cartLines.filter(
      (l) => !alreadyDiscounted.has(l.variantId) && l.quantity >= minQty,
    );

    if (eligibleLines.length === 0) {
      skipped.push({ promotionId: promo.id, reason: `No items meet min quantity of ${minQty}` });
      continue;
    }

    let totalDiscount = new Decimal(0);
    const affectedLines: string[] = [];

    for (const line of eligibleLines) {
      // Free units = floor(quantity / minQty)
      const freeUnits = Math.floor(line.quantity / minQty);
      if (freeUnits <= 0) continue;

      const unitPrice = new Decimal(line.unitPrice);
      const disc = unitPrice.times(freeUnits).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalDiscount = totalDiscount.plus(disc);
      affectedLines.push(line.variantId);
      alreadyDiscounted.add(line.variantId);
    }

    if (affectedLines.length > 0) {
      applied.push({
        promotionId: promo.id,
        label: promo.name,
        discountAmount: totalDiscount.toString(),
        promotionType: promo.type,
        affectedLines,
      });
    }
  }

  return { applied, skipped };
}

// ── Evaluate Cart-Level Promotions ───────────────────────────────────────────

export function evaluateCartPromotions(
  cartLines: CartLine[],
  subtotal: Decimal,
  promos: PromotionRow[],
): { applied: AppliedDiscount[]; skipped: SkippedPromotion[] } {
  const applied: AppliedDiscount[] = [];
  const skipped: SkippedPromotion[] = [];

  if (promos.length === 0) return { applied, skipped };

  // Find best cart-level promo
  let bestDiscount = new Decimal(0);
  let bestPromo: PromotionRow | null = null;

  for (const promo of promos) {
    const value = new Decimal(promo.value.toString());
    let disc: Decimal;

    if (promo.type === 'CART_PERCENTAGE') {
      disc = subtotal.times(value).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      // CART_FIXED
      disc = Decimal.min(value, subtotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    if (disc.greaterThan(bestDiscount)) {
      bestDiscount = disc;
      bestPromo = promo;
    }
  }

  if (bestPromo && bestDiscount.greaterThan(0)) {
    applied.push({
      promotionId: bestPromo.id,
      label: `${bestPromo.name} — ${bestPromo.type === 'CART_PERCENTAGE' ? `${new Decimal(bestPromo.value.toString())}% off cart` : `₹${new Decimal(bestPromo.value.toString())} off cart`}`,
      discountAmount: bestDiscount.toString(),
      promotionType: bestPromo.type,
      affectedLines: cartLines.map((l) => l.variantId),
    });

    // Skip the rest
    for (const promo of promos) {
      if (promo.id !== bestPromo.id) {
        skipped.push({ promotionId: promo.id, reason: 'Better cart promotion applied' });
      }
    }
  }

  return { applied, skipped };
}

// ── Validate Promo Code ──────────────────────────────────────────────────────

export async function validatePromoCode(
  tenantId: string,
  code: string,
  cartLines: CartLine[],
): Promise<AppliedDiscount | { error: { code: string; message: string } }> {
  const now = new Date();
  const promo = await prisma.promotion.findFirst({
    where: {
      tenantId,
      type: 'PROMO_CODE',
      isActive: true,
      promoCode: { equals: code, mode: 'insensitive' },
    },
  });

  if (!promo) {
    return { error: { code: 'INVALID_PROMO_CODE', message: 'Promo code not found or inactive' } };
  }

  if (promo.startsAt && promo.startsAt > now) {
    return { error: { code: 'PROMO_NOT_STARTED', message: 'Promo code is not yet active' } };
  }
  if (promo.endsAt && promo.endsAt < now) {
    return { error: { code: 'PROMO_EXPIRED', message: 'Promo code has expired' } };
  }

  const value = new Decimal(promo.value.toString());
  const subtotal = cartLines.reduce((sum, l) => {
    const lineTotal = new Decimal(l.unitPrice).times(l.quantity);
    const manualDisc = l.manualDiscountAmount ? new Decimal(l.manualDiscountAmount) : new Decimal(0);
    return sum.plus(lineTotal.minus(manualDisc));
  }, new Decimal(0));

  const disc = subtotal.times(value).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    promotionId: promo.id,
    label: `${promo.name} — ${value.toString()}% off (code: ${promo.promoCode})`,
    discountAmount: disc.toString(),
    promotionType: 'PROMO_CODE',
    affectedLines: cartLines.map((l) => l.variantId),
  };
}

// ── Main Orchestrator ────────────────────────────────────────────────────────

export async function evaluatePromotions(
  tenantId: string,
  cartLines: CartLine[],
  customerId?: string | undefined,
  promoCode?: string | undefined,
): Promise<EvaluationResult> {
  const appliedDiscounts: AppliedDiscount[] = [];
  const skippedPromotions: SkippedPromotion[] = [];
  const alreadyDiscounted = new Set<string>();

  // 1. Customer pricing
  const customerDiscounts = await evaluateCustomerPricing(tenantId, cartLines, customerId);
  appliedDiscounts.push(...customerDiscounts);
  for (const d of customerDiscounts) {
    for (const lineId of d.affectedLines) {
      alreadyDiscounted.add(lineId);
    }
  }

  // 2. Fetch automatic promotions
  const grouped = await fetchActivePromotions(tenantId);

  // 3. Category discounts
  const catResult = evaluateCategoryDiscounts(cartLines, grouped.CATEGORY_PERCENTAGE, alreadyDiscounted);
  appliedDiscounts.push(...catResult.applied);
  skippedPromotions.push(...catResult.skipped);

  // 4. BOGO / Mix & Match
  const bogoResult = evaluateBOGO(cartLines, [...grouped.BOGO, ...grouped.MIX_AND_MATCH], alreadyDiscounted);
  appliedDiscounts.push(...bogoResult.applied);
  skippedPromotions.push(...bogoResult.skipped);

  // 5. Cart-level promotions
  const subtotal = cartLines.reduce((sum, l) => {
    const lineTotal = new Decimal(l.unitPrice).times(l.quantity);
    const manualDisc = l.manualDiscountAmount ? new Decimal(l.manualDiscountAmount) : new Decimal(0);
    return sum.plus(lineTotal.minus(manualDisc));
  }, new Decimal(0));

  const cartResult = evaluateCartPromotions(cartLines, subtotal, [...grouped.CART_PERCENTAGE, ...grouped.CART_FIXED]);
  appliedDiscounts.push(...cartResult.applied);
  skippedPromotions.push(...cartResult.skipped);

  // 6. Promo code
  if (promoCode) {
    const codeResult = await validatePromoCode(tenantId, promoCode, cartLines);
    if ('error' in codeResult) {
      skippedPromotions.push({ promotionId: 'promo_code', reason: codeResult.error.message });
    } else {
      appliedDiscounts.push(codeResult);
    }
  }

  const totalDiscountAmount = appliedDiscounts
    .reduce((sum, d) => sum.plus(new Decimal(d.discountAmount)), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toString();

  return { appliedDiscounts, skippedPromotions, totalDiscountAmount };
}

// ── CRUD Functions ───────────────────────────────────────────────────────────

export async function getPromotions(tenantId: string) {
  return prisma.promotion.findMany({
    where: { tenantId },
    include: { targetCategory: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createPromotion(tenantId: string, data: CreatePromotionInput) {
  return prisma.promotion.create({
    data: {
      tenantId,
      name: data.name,
      type: data.type as PromotionType,
      value: data.value,
      ...(data.promoCode !== undefined && { promoCode: data.promoCode }),
      ...(data.targetCategoryId !== undefined && { targetCategoryId: data.targetCategoryId }),
      ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && { endsAt: new Date(data.endsAt) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });
}

export async function updatePromotion(tenantId: string, id: string, data: UpdatePromotionInput) {
  return prisma.promotion.update({
    where: { id, tenantId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type as PromotionType }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.promoCode !== undefined && { promoCode: data.promoCode }),
      ...(data.targetCategoryId !== undefined && { targetCategoryId: data.targetCategoryId }),
      ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && { endsAt: new Date(data.endsAt) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });
}

export async function togglePromotion(tenantId: string, id: string) {
  const promo = await prisma.promotion.findFirst({ where: { id, tenantId } });
  if (!promo) throw new Error('Promotion not found');
  return prisma.promotion.update({
    where: { id },
    data: { isActive: !promo.isActive },
  });
}
