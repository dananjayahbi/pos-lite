import { z } from 'zod';

import { promotionTypeIssues } from '@/lib/services/promotionValidation.core';
import { isValidWindowInput, windowIssues } from '@/lib/services/promotionWindow.core';

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

/**
 * ARGUS #328 — a typed date contract at the request boundary. Anything that
 * is not a real calendar day or a parseable ISO datetime is a 400
 * VALIDATION_ERROR instead of an Invalid Date reaching Prisma (which used to
 * surface as a 500).
 */
const PromotionDateSchema = z
  .string()
  .trim()
  .refine(
    isValidWindowInput,
    'Must be a valid date (YYYY-MM-DD or ISO datetime)',
  );

/** Create: '' (untouched date input) → undefined → NULL (open bound). */
const CreateWindowDateSchema = z
  .union([z.literal(''), PromotionDateSchema])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/** Update: '' / explicit null → NULL (clear the bound); undefined = untouched. */
const UpdateWindowDateSchema = z
  .union([z.literal(''), z.null(), PromotionDateSchema])
  .optional()
  .transform((value) => (value === '' ? null : value));

/**
 * ARGUS #330 — an empty string is the form's "not selected" sentinel and
 * normalizes to undefined on create; on update it clears the nullable column.
 */
const CreateNullableIdSchema = z
  .union([z.literal(''), z.string().trim().min(1)])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const UpdateNullableIdSchema = z
  .union([z.literal(''), z.null(), z.string().trim().min(1)])
  .optional()
  .transform((value) => (value === '' ? null : value));

const PromotionFields = {
  name: z.string().min(1).max(100),
  type: z.enum([
    'CART_PERCENTAGE',
    'CART_FIXED',
    'CATEGORY_PERCENTAGE',
    'PRODUCT_PERCENTAGE',
    'PRODUCT_FIXED',
    'BOGO',
    'MIX_AND_MATCH',
    'PROMO_CODE',
  ]),
  value: z.number().min(0),
  promoCode: z.string().trim().toUpperCase().max(50).optional(),
  targetCategoryId: CreateNullableIdSchema,
  targetProductId: CreateNullableIdSchema,
  // M15-02: int column bound; min stays 1 because `evaluateBOGO` divides by
  // `minQuantity` (0 would make free units Infinity).
  minQuantity: z.number().int().min(1).max(MAX_MIN_QUANTITY).optional(),
  startsAt: CreateWindowDateSchema,
  endsAt: CreateWindowDateSchema,
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional(),
};

const PromotionBaseSchema = z.object(PromotionFields);

/**
 * PATCH contract: same field shapes, every field optional, and the value/date
 * bounds still applied. Built from its own shape (rather than
 * `CreatePromotionSchema.partial()`) so the null/undefined transforms and the
 * refinements are attached explicitly and cannot be dropped by `.partial()`.
 */
const PromotionUpdateBaseSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: PromotionFields.type.optional(),
  value: z.number().min(0).optional(),
  promoCode: z.string().trim().toUpperCase().max(50).optional(),
  targetCategoryId: UpdateNullableIdSchema,
  targetProductId: UpdateNullableIdSchema,
  minQuantity: z.number().int().min(1).max(MAX_MIN_QUANTITY).optional(),
  startsAt: UpdateWindowDateSchema,
  endsAt: UpdateWindowDateSchema,
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional(),
});

type PromotionWindowInput = {
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
};

/** Shared refinements: value bounds, type requirements, window order. */
function applyPromotionRefinements(
  data: PromotionWindowInput & {
    type?: string | undefined;
    value?: number | undefined;
    promoCode?: string | undefined;
    targetCategoryId?: string | null | undefined;
    targetProductId?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  assertValueBounds(data, ctx);

  for (const issue of promotionTypeIssues(data)) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }

  for (const issue of windowIssues(data.startsAt, data.endsAt)) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }
}

export const CreatePromotionSchema = PromotionBaseSchema.superRefine(
  applyPromotionRefinements,
);

export const UpdatePromotionSchema = PromotionUpdateBaseSchema.superRefine(
  applyPromotionRefinements,
);

/**
 * ARGUS #334 — evaluate input hardening.
 *
 * `unitPrice`/`manualDiscountAmount` were any non-empty string, so a caller
 * could send `abc` (Decimal throws -> 500) or `-100` (a negative discount that
 * credits the customer). Money is a non-negative decimal string, bounded by
 * the Promotion money ceiling, and a manual discount cannot exceed its line.
 */
const MAX_EVALUATE_MONEY = 9_999_999_999.99;
const MAX_CART_LINE_QUANTITY = 1_000_000;
const MONEY_TEXT = /^\d+(?:\.\d{1,2})?$/;

const evaluateMoney = z
  .string()
  .trim()
  .min(1, 'Amount is required')
  .regex(MONEY_TEXT, 'Amount must be a non-negative number with at most 2 decimals')
  .refine((value) => Number(value) <= MAX_EVALUATE_MONEY, {
    message: `Amount cannot exceed ${MAX_EVALUATE_MONEY.toFixed(2)}`,
  });

const EvaluateCartLineSchema = z
  .object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1).max(MAX_CART_LINE_QUANTITY),
    unitPrice: evaluateMoney,
    manualDiscountAmount: evaluateMoney.optional(),
    categoryId: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    if (line.manualDiscountAmount === undefined) return;
    const lineTotal = Number(line.unitPrice) * line.quantity;
    if (Number(line.manualDiscountAmount) > lineTotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['manualDiscountAmount'],
        message: 'Manual discount cannot exceed the line total',
      });
    }
  });

export const EvaluateCartSchema = z.object({
  cartLines: z.array(EvaluateCartLineSchema).min(1),
  customerId: z.string().optional(),
  promoCode: z.string().trim().max(50).optional(),
});

export type CreatePromotionInput = z.infer<typeof CreatePromotionSchema>;
/** Raw form shape before the schema's '' -> undefined/null normalization. */
export type CreatePromotionFormValues = z.input<typeof CreatePromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;
export type EvaluateCartInput = z.infer<typeof EvaluateCartSchema>;
