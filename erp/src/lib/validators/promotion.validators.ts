import { z } from 'zod';

/**
 * M15-02 (BUG-47) — `value` is bounded per promotion `type`.
 *
 * `value` previously accepted any number ≥ 0 (only `min(0)`), so a hostile but
 * finite input such as `Number.MAX_SAFE_INTEGER` passed validation and only
 * failed when it reached the `Decimal(12,2)` column — surfacing as a generic
 * 500 on what is a client-input error. Each branch below is anchored on a real
 * storage/evaluation limit, and every bound is deliberately loose enough that
 * the existing valid promotion flows (percentages, cent-level fixed discounts,
 * whole free-item quantities) are untouched:
 *
 *  - PERCENTAGE types (`CART_PERCENTAGE`, `CATEGORY_PERCENTAGE`,
 *    `PRODUCT_PERCENTAGE`, `PROMO_CODE`) are consumed as `subtotal * value /
 *    100` → cap at 100 so a "discount" can never credit the customer more than
 *    the cart is worth.
 *  - `CART_FIXED` / `PRODUCT_FIXED` are LKR amounts stored in
 *    `Promotion.value Decimal(12,2)` → cap at the column ceiling and require
 *    ≤ 2 decimal places.
 *  - `BOGO` / `MIX_AND_MATCH` carry an item value cap in LKR (the most a
 *    single free unit can be worth) → same money ceiling as fixed amounts.
 */

/** `Promotion.value` is `Decimal @db.Decimal(12, 2)` in prisma/schema.prisma. */
const MAX_PROMOTION_MONEY = 9999999999.99;
/** A discount above 100% would pay the customer to take the cart. */
const MAX_PROMOTION_PERCENT = 100;
/** `minQuantity` ceiling: keeps the Int column and `evaluateBOGO`'s division sane. */
const MAX_MIN_QUANTITY = 1_000_000;

const PERCENTAGE_TYPES = ['CART_PERCENTAGE', 'CATEGORY_PERCENTAGE', 'PRODUCT_PERCENTAGE', 'PROMO_CODE'] as const;
const FREE_ITEM_TYPES = ['BOGO', 'MIX_AND_MATCH'] as const;

/** At most 2 decimal places, tolerant of binary-float representation error. */
function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/**
 * Type-aware `value` bound. Runs on the base shapes (create and update) so a
 * PATCH carrying only `value` still gets the universal money ceiling — without
 * the row's `type` we cannot pick a tighter per-type bound, so PATCH only
 * enforces the storage-safe maximum.
 */
function assertValueBounds(
  data: { type?: string | undefined; value?: number | undefined },
  ctx: z.RefinementCtx,
): void {
  const { type, value } = data;
  if (value === undefined) return;

  // Every message names `value` so the 400 envelope identifies the offending
  // field for both the form UI and the API contract.
  if (!Number.isFinite(value)) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Value must be a finite number' });
    return;
  }
  if (value < 0) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Value must be zero or greater' });
    return;
  }

  if (type === undefined) {
    // Partial update without a type: only the storage ceiling is knowable.
    if (value > MAX_PROMOTION_MONEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Value cannot exceed ${MAX_PROMOTION_MONEY.toFixed(2)}`,
      });
    }
    return;
  }

  if ((PERCENTAGE_TYPES as readonly string[]).includes(type)) {
    if (value > MAX_PROMOTION_PERCENT) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Value cannot exceed ${MAX_PROMOTION_PERCENT} for a percentage promotion`,
      });
    }
    return;
  }

  if ((FREE_ITEM_TYPES as readonly string[]).includes(type)) {
    // ARGUS #324: value is the LKR cap per free unit, not a free-item count.
    if (value > MAX_PROMOTION_MONEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `Item value cap cannot exceed ${MAX_PROMOTION_MONEY.toFixed(2)}`,
      });
      return;
    }
    if (!hasAtMostTwoDecimals(value)) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Item value cap supports at most 2 decimal places',
      });
    }
    return;
  }

  // CART_FIXED / PRODUCT_FIXED — LKR amount.
  if (value > MAX_PROMOTION_MONEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['value'],
      message: `Value cannot exceed ${MAX_PROMOTION_MONEY.toFixed(2)}`,
    });
    return;
  }
  if (!hasAtMostTwoDecimals(value)) {
    ctx.addIssue({
      code: 'custom',
      path: ['value'],
      message: 'Value supports at most 2 decimal places',
    });
  }
}

const PromotionBaseSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['CART_PERCENTAGE', 'CART_FIXED', 'CATEGORY_PERCENTAGE', 'PRODUCT_PERCENTAGE', 'PRODUCT_FIXED', 'BOGO', 'MIX_AND_MATCH', 'PROMO_CODE']),
  value: z.number().min(0),
  promoCode: z.string().max(50).optional(),
  targetCategoryId: z.string().optional(),
  targetProductId: z.string().optional(),
  // M15-02: int column bound; min stays 1 because `evaluateBOGO` divides by
  // `minQuantity` (0 would make free units Infinity).
  minQuantity: z.number().int().min(1).max(MAX_MIN_QUANTITY).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional(),
});

/**
 * ARGUS #324: a free-item promotion must name what it applies to. Without a
 * target the evaluator skips it rather than giving a free unit on every line.
 */
function assertFreeItemTarget(
  data: { type?: string | undefined; targetProductId?: string | undefined; targetCategoryId?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (data.type !== 'BOGO' && data.type !== 'MIX_AND_MATCH') return;
  if (data.targetProductId || data.targetCategoryId) return;
  ctx.addIssue({
    code: 'custom',
    path: ['targetProductId'],
    message: 'Select a target product or category for a free-item promotion',
  });
}

export const CreatePromotionSchema = PromotionBaseSchema.superRefine((data, ctx) => {
  assertValueBounds(data, ctx);
  assertFreeItemTarget(data, ctx);
});

/**
 * PATCH contract: same field shapes, every field optional, and the value bounds
 * still applied. It is built from the base shape (rather than
 * `CreatePromotionSchema.partial()`) so the refinement is attached explicitly
 * and cannot be dropped by the `.partial()` projection.
 */
export const UpdatePromotionSchema = PromotionBaseSchema.partial().superRefine(assertValueBounds);

export const EvaluateCartSchema = z.object({
  cartLines: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1),
    unitPrice: z.string().min(1),
    manualDiscountAmount: z.string().optional(),
    categoryId: z.string().optional(),
  })).min(1),
  customerId: z.string().optional(),
  promoCode: z.string().optional(),
});

export type CreatePromotionInput = z.infer<typeof CreatePromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;
export type EvaluateCartInput = z.infer<typeof EvaluateCartSchema>;
