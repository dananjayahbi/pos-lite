import Decimal from 'decimal.js';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  applyFixedToRemaining,
  applyPercentageToRemaining,
  remainingAfterDiscounts,
} from '@/lib/services/promotionStacking.core';
import type { PromotionType } from '@/generated/prisma/client';
import type { CreatePromotionInput, UpdatePromotionInput } from '@/lib/validators/promotion.validators';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { planPromotionStatusChange } from '@/lib/services/promotionStatus.core';

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
  PRODUCT_PERCENTAGE: PromotionRow[];
  PRODUCT_FIXED: PromotionRow[];
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
  targetProductId: string | null;
  minQuantity: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
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
    // Deterministic precedence: newest campaign wins. Evaluation is
    // first-match-wins per line (`alreadyDiscounted`), so without an explicit
    // order two active promos targeting the same category would resolve
    // arbitrarily depending on physical row order — the merchant's most
    // recently created promotion must take effect, reproducibly.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const grouped: GroupedPromotions = {
    CART_PERCENTAGE: [],
    CART_FIXED: [],
    CATEGORY_PERCENTAGE: [],
    PRODUCT_PERCENTAGE: [],
    PRODUCT_FIXED: [],
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

/**
 * ARGUS #323 — replace every client-supplied category with the category the
 * variant really belongs to. A cart payload can claim any categoryId; only the
 * server-resolved map is trusted. Unknown/foreign variants get `undefined`, so
 * they cannot claim a category promotion.
 */
export function applyResolvedCategories(
  cartLines: CartLine[],
  categoryByVariantId: ReadonlyMap<string, string | null | undefined>,
): CartLine[] {
  return cartLines.map((line) => ({
    ...line,
    categoryId: categoryByVariantId.get(line.variantId) ?? undefined,
  }));
}

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
      label: `${promo.name} - ${value.toString()}% off category`,
      discountAmount: totalDiscount.toString(),
      promotionType: 'CATEGORY_PERCENTAGE',
      affectedLines,
    });
  }

  return { applied, skipped };
}

// ── Evaluate Product Discounts ───────────────────────────────────────────────

/**
 * Percentage discount scoped to one product. `productByVariantId` maps cart
 * variants to their parent product so the promotion applies to every variant
 * of the targeted product.
 */
export function evaluateProductDiscounts(
  cartLines: CartLine[],
  promos: PromotionRow[],
  alreadyDiscounted: Set<string>,
  productByVariantId: Map<string, string>,
): { applied: AppliedDiscount[]; skipped: SkippedPromotion[] } {
  const applied: AppliedDiscount[] = [];
  const skipped: SkippedPromotion[] = [];

  for (const promo of promos) {
    if (!promo.targetProductId) {
      skipped.push({ promotionId: promo.id, reason: 'No target product set' });
      continue;
    }

    const matchingLines = cartLines.filter(
      (l) =>
        productByVariantId.get(l.variantId) === promo.targetProductId &&
        !alreadyDiscounted.has(l.variantId),
    );

    if (matchingLines.length === 0) {
      skipped.push({ promotionId: promo.id, reason: 'No matching items in cart' });
      continue;
    }

    const value = new Decimal(promo.value.toString());
    const isFixed = promo.type === 'PRODUCT_FIXED';
    let totalDiscount = new Decimal(0);
    const affectedLines: string[] = [];

    for (const line of matchingLines) {
      const lineTotal = new Decimal(line.unitPrice).times(line.quantity);
      const manualDisc = line.manualDiscountAmount ? new Decimal(line.manualDiscountAmount) : new Decimal(0);
      const afterManual = lineTotal.minus(manualDisc);
      // Percentage: a share of the line. Fixed: a flat LKR amount off the line,
      // capped so one promotion can never discount more than the line is worth.
      const disc = isFixed
        ? Decimal.min(value, afterManual).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : afterManual.times(value).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalDiscount = totalDiscount.plus(disc);
      affectedLines.push(line.variantId);
      alreadyDiscounted.add(line.variantId);
    }

    applied.push({
      promotionId: promo.id,
      label: isFixed
        ? `${promo.name} - Rs. ${value.toFixed(2)} off product`
        : `${promo.name} - ${value.toString()}% off product`,
      discountAmount: totalDiscount.toString(),
      promotionType: promo.type,
      affectedLines,
    });
  }

  return { applied, skipped };
}

// ── Evaluate BOGO / Mix & Match ──────────────────────────────────────────────

/**
 * ARGUS #324 — buy-N-get-free on the targeted lines only.
 *
 * Contract (no schema change):
 *  - `minQuantity` = buy N on a single line.
 *  - `value` = maximum LKR value of one free unit.
 *  - Free units = floor(line.quantity / N), evaluated PER LINE (documented
 *    choice; the form preview says the same). The discount is
 *    min(unitPrice, cap) × free units.
 *  - A promotion with no target product/category, or a non-positive cap, is
 *    skipped with a reason — never applied to the whole cart.
 */
export function evaluateBOGO(
  cartLines: CartLine[],
  promos: PromotionRow[],
  alreadyDiscounted: Set<string>,
  productByVariantId: ReadonlyMap<string, string> = new Map(),
): { applied: AppliedDiscount[]; skipped: SkippedPromotion[] } {
  const applied: AppliedDiscount[] = [];
  const skipped: SkippedPromotion[] = [];

  for (const promo of promos) {
    if (!promo.targetProductId && !promo.targetCategoryId) {
      skipped.push({ promotionId: promo.id, reason: 'No target product or category set' });
      continue;
    }

    const cap = new Decimal(promo.value.toString());
    if (cap.lessThanOrEqualTo(0)) {
      skipped.push({ promotionId: promo.id, reason: 'Item value cap must be greater than zero' });
      continue;
    }

    const minQty = promo.minQuantity ?? 2;

    const matchesTarget = (line: CartLine): boolean => {
      const productMatch = promo.targetProductId
        ? productByVariantId.get(line.variantId) === promo.targetProductId
        : true;
      const categoryMatch = promo.targetCategoryId
        ? line.categoryId === promo.targetCategoryId
        : true;
      return productMatch && categoryMatch;
    };

    const eligibleLines = cartLines.filter(
      (l) => !alreadyDiscounted.has(l.variantId) && l.quantity >= minQty && matchesTarget(l),
    );

    if (eligibleLines.length === 0) {
      skipped.push({
        promotionId: promo.id,
        reason: `No targeted items meet the buy quantity of ${minQty}`,
      });
      continue;
    }

    let totalDiscount = new Decimal(0);
    const affectedLines: string[] = [];

    for (const line of eligibleLines) {
      const freeUnits = Math.floor(line.quantity / minQty);
      if (freeUnits <= 0) continue;

      // Cap the value of each free unit; a Rs 2500 cap on a Rs 500 item still
      // gives the full Rs 500 unit away.
      const unitPrice = new Decimal(line.unitPrice);
      const perFreeUnit = Decimal.min(unitPrice, cap);
      const disc = perFreeUnit.times(freeUnits).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalDiscount = totalDiscount.plus(disc);
      affectedLines.push(line.variantId);
      alreadyDiscounted.add(line.variantId);
    }

    if (affectedLines.length > 0) {
      applied.push({
        promotionId: promo.id,
        label: `${promo.name} - Buy ${minQty}, get floor(qty/${minQty}) free (up to ${cap.toFixed(2)} each)`,
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
      disc = new Decimal(
        applyPercentageToRemaining(subtotal.toNumber(), value.toNumber()),
      );
    } else {
      // CART_FIXED
      disc = new Decimal(applyFixedToRemaining(subtotal.toNumber(), value.toNumber()));
    }

    if (disc.greaterThan(bestDiscount)) {
      bestDiscount = disc;
      bestPromo = promo;
    }
  }

  if (bestPromo && bestDiscount.greaterThan(0)) {
    applied.push({
      promotionId: bestPromo.id,
      label: `${bestPromo.name} - ${bestPromo.type === 'CART_PERCENTAGE' ? `${new Decimal(bestPromo.value.toString())}% off cart` : `₹${new Decimal(bestPromo.value.toString())} off cart`}`,
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
  remainingSubtotal?: number,
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
  const eligibleSubtotal = cartLines.reduce((sum, l) => {
    const lineTotal = new Decimal(l.unitPrice).times(l.quantity);
    const manualDisc = l.manualDiscountAmount ? new Decimal(l.manualDiscountAmount) : new Decimal(0);
    return sum.plus(lineTotal.minus(manualDisc));
  }, new Decimal(0));

  // The code applies after the line/cart promotions: never on the original
  // subtotal, and never more than what is left (ARGUS #322).
  const base = remainingSubtotal !== undefined
    ? Decimal.min(eligibleSubtotal, new Decimal(Math.max(0, remainingSubtotal)))
    : eligibleSubtotal;

  const disc = new Decimal(applyPercentageToRemaining(base.toNumber(), value.toNumber()));

  return {
    promotionId: promo.id,
    label: `${promo.name} - ${value.toString()}% off (code: ${promo.promoCode})`,
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

  // ARGUS #323: resolve product/category from the database once. The client's
  // categoryId is never trusted — a spoofed category cannot claim a promotion.
  const variantIds = [...new Set(cartLines.map((line) => line.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, product: { tenantId } },
    select: { id: true, productId: true, product: { select: { categoryId: true } } },
  });
  const productByVariantId = new Map(variants.map((variant) => [variant.id, variant.productId]));
  const categoryByVariantId = new Map(
    variants.map((variant) => [variant.id, variant.product.categoryId]),
  );
  const resolvedCartLines = applyResolvedCategories(cartLines, categoryByVariantId);

  // 3. Product discounts (most specific first: product beats category/cart).
  // Percentage and fixed product promotions share the same target-product
  // contract and precedence; the newer fixed type wins its target first because
  // promotions are evaluated newest-first within this step.
  const productPromotions = [
    ...grouped.PRODUCT_PERCENTAGE,
    ...grouped.PRODUCT_FIXED,
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (productPromotions.length > 0) {
    const productResult = evaluateProductDiscounts(
      resolvedCartLines,
      productPromotions,
      alreadyDiscounted,
      productByVariantId,
    );
    appliedDiscounts.push(...productResult.applied);
    skippedPromotions.push(...productResult.skipped);
  }

  // 4. Category discounts
  const catResult = evaluateCategoryDiscounts(resolvedCartLines, grouped.CATEGORY_PERCENTAGE, alreadyDiscounted);
  appliedDiscounts.push(...catResult.applied);
  skippedPromotions.push(...catResult.skipped);

  // 5. BOGO / Mix & Match
  const bogoResult = evaluateBOGO(
    resolvedCartLines,
    [...grouped.BOGO, ...grouped.MIX_AND_MATCH],
    alreadyDiscounted,
    productByVariantId,
  );
  appliedDiscounts.push(...bogoResult.applied);
  skippedPromotions.push(...bogoResult.skipped);

  // 6. Cart-level promotions run on what is left after the line-level
  // discounts, not the original subtotal (ARGUS #322).
  const subtotal = resolvedCartLines.reduce((sum, l) => {
    const lineTotal = new Decimal(l.unitPrice).times(l.quantity);
    const manualDisc = l.manualDiscountAmount ? new Decimal(l.manualDiscountAmount) : new Decimal(0);
    return sum.plus(lineTotal.minus(manualDisc));
  }, new Decimal(0));

  const lineDiscountTotal = appliedDiscounts.reduce(
    (sum, discount) => sum + Number(discount.discountAmount),
    0,
  );
  let remaining = remainingAfterDiscounts(subtotal.toNumber(), [lineDiscountTotal]);

  const cartResult = evaluateCartPromotions(
    resolvedCartLines,
    new Decimal(remaining),
    [...grouped.CART_PERCENTAGE, ...grouped.CART_FIXED],
  );
  appliedDiscounts.push(...cartResult.applied);
  skippedPromotions.push(...cartResult.skipped);

  remaining = remainingAfterDiscounts(
    remaining,
    cartResult.applied.map((discount) => Number(discount.discountAmount)),
  );

  // 7. Promo code applies to the remainder only.
  if (promoCode) {
    const codeResult = await validatePromoCode(tenantId, promoCode, resolvedCartLines, remaining);
    if ('error' in codeResult) {
      skippedPromotions.push({ promotionId: 'promo_code', reason: codeResult.error.message });
    } else {
      appliedDiscounts.push(codeResult);
    }
  }

  const rawDiscountAmount = appliedDiscounts
    .reduce((sum, d) => sum.plus(new Decimal(d.discountAmount)), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Hard cap: the combined promotions can never discount more than the cart is
  // worth, even if a rule was misconfigured.
  const totalDiscountAmount = Decimal.min(rawDiscountAmount, subtotal)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toString();

  return { appliedDiscounts, skippedPromotions, totalDiscountAmount };
}

// ── CRUD Functions ───────────────────────────────────────────────────────────

export async function getPromotions(tenantId: string) {
  return prisma.promotion.findMany({
    where: { tenantId },
    include: {
      targetCategory: { select: { id: true, name: true } },
      targetProduct: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createPromotion(tenantId: string, data: CreatePromotionInput) {
  const promo = await prisma.promotion.create({
    data: {
      tenantId,
      name: data.name,
      type: data.type as PromotionType,
      value: data.value,
      ...(data.promoCode !== undefined && { promoCode: data.promoCode }),
      ...(data.targetCategoryId !== undefined && { targetCategoryId: data.targetCategoryId }),
      ...(data.targetProductId !== undefined && { targetProductId: data.targetProductId }),
      ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && { endsAt: new Date(data.endsAt) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  void createAuditLog({
    tenantId,
    actorId: null,
    actorRole: 'SYSTEM',
    entityType: 'Promotion',
    entityId: promo.id,
    action: AUDIT_ACTIONS.PROMOTION_CREATED,
    after: { name: promo.name, type: promo.type, value: promo.value.toString() },
  }).catch(() => {});

  return promo;
}

export async function updatePromotion(tenantId: string, id: string, data: UpdatePromotionInput) {
  const updated = await prisma.promotion.update({
    where: { id, tenantId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type as PromotionType }),
      ...(data.value !== undefined && { value: data.value }),
      ...(data.promoCode !== undefined && { promoCode: data.promoCode }),
      ...(data.targetCategoryId !== undefined && { targetCategoryId: data.targetCategoryId }),
      ...(data.targetProductId !== undefined && { targetProductId: data.targetProductId }),
      ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.endsAt !== undefined && { endsAt: new Date(data.endsAt) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  void createAuditLog({
    tenantId,
    actorId: null,
    actorRole: 'SYSTEM',
    entityType: 'Promotion',
    entityId: id,
    action: AUDIT_ACTIONS.PROMOTION_UPDATED,
    after: data as Prisma.InputJsonValue,
  }).catch(() => {});

  return updated;
}

export async function setPromotionActive(
  tenantId: string,
  id: string,
  isActive: boolean,
  actorId?: string | undefined,
) {
  const promo = await prisma.promotion.findFirst({ where: { id, tenantId } });
  if (!promo) throw new Error('Promotion not found');

  const plan = planPromotionStatusChange(promo.isActive, isActive);
  if (!plan.changed) return promo;

  const updated = await prisma.promotion.update({
    where: { id },
    data: { isActive: plan.isActive },
  });

  void createAuditLog({
    tenantId,
    actorId: actorId ?? null,
    actorRole: actorId ? 'USER' : 'SYSTEM',
    entityType: 'Promotion',
    entityId: id,
    action: plan.auditAction === 'PROMOTION_ACTIVATED'
      ? AUDIT_ACTIONS.PROMOTION_ACTIVATED
      : AUDIT_ACTIONS.PROMOTION_ARCHIVED,
    before: { isActive: promo.isActive },
    after: { isActive: plan.isActive },
  }).catch(() => {});

  return updated;
}

/** Idempotent: an already-inactive promotion stays inactive. */
export async function deactivatePromotion(
  tenantId: string,
  id: string,
  actorId?: string | undefined,
) {
  return setPromotionActive(tenantId, id, false, actorId);
}

/** Explicit reactivation; never reachable through the Deactivate action. */
export async function activatePromotion(
  tenantId: string,
  id: string,
  actorId?: string | undefined,
) {
  return setPromotionActive(tenantId, id, true, actorId);
}
