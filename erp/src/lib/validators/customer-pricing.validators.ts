import { z } from 'zod';
import { zPrice, zSafeShortText } from '@/lib/validators/shared';

/**
 * M15-01 (BUG-46) — request validators for the `CustomerPricingRule` CRUD API
 * (`/api/store/customer-pricing-rules`).
 *
 * The field contract mirrors exactly what `evaluateCustomerPricing`
 * (`src/lib/services/promotion.service.ts`) reads back at cart time:
 *  - `customerTag` is matched against `Customer.tags` (exact string);
 *  - `variantId` NULL means "every variant" (evaluation ORs `{ variantId: null }`);
 *  - `price` is the flat per-unit customer price (it only applies when it is
 *    BELOW the line unit price), bounded by the Decimal(12,2) column;
 *  - `startsAt`/`endsAt` NULL = open-ended bound — evaluation treats NULL as
 *    "no lower/upper limit", so blank inputs normalize to undefined/NULL and
 *    the CRUD overlap guard uses the same semantics.
 */

/** Decimal(12,2) column ceiling for the price field. */
const MAX_RULE_PRICE = 9999999999.99;

/** 'YYYY-MM-DD' or full ISO datetime strings (same shape XC-01 accepts). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T\s].*)?$/;

const IsoDateTimeSchema = z
  .string()
  .trim()
  .refine(
    (v) => ISO_DATE_RE.test(v) && !Number.isNaN(new Date(v).getTime()),
    'Must be an ISO date or datetime (YYYY-MM-DD / YYYY-MM-DDTHH:mm:ss)',
  );

/** Create: optional window bound; '' (untouched date input) → undefined → NULL. */
const OptionalWindowDateSchema = z
  .union([z.literal(''), IsoDateTimeSchema])
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** Update: window bound; '' / explicit null → NULL (clear the bound), undefined = untouched. */
const UpdateWindowDateSchema = z
  .union([z.literal(''), z.null(), IsoDateTimeSchema])
  .optional()
  .transform((v) => (v === '' ? null : v));

/** Create: optional variant cuid; '' → undefined (NULL = applies to every variant). */
const OptionalVariantSchema = z
  .union([z.literal(''), z.string().trim().cuid()])
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** Update: variant; '' / null → NULL (revert to all-variants), undefined = untouched. */
const UpdateVariantSchema = z
  .union([z.literal(''), z.null(), z.string().trim().cuid()])
  .optional()
  .transform((v) => (v === '' ? null : v));

/** Flat customer price: > 0, ≤ Decimal(12,2) ceiling, at most 2 dp (INF-04 zPrice). */
const RulePriceSchema = zPrice().refine(
  (v) => v > 0 && v <= MAX_RULE_PRICE,
  `Price must be greater than 0 and at most ${MAX_RULE_PRICE.toFixed(2)}`,
);

const CustomerPricingRuleBaseSchema = z.object({
  // Keys off the M05 tag model: exact match against a value in Customer.tags.
  customerTag: zSafeShortText(60),
  variantId: OptionalVariantSchema,
  price: RulePriceSchema,
  startsAt: OptionalWindowDateSchema,
  endsAt: OptionalWindowDateSchema,
  isActive: z.boolean().optional(),
});

const CustomerPricingRuleUpdateBaseSchema = z.object({
  customerTag: zSafeShortText(60).optional(),
  variantId: UpdateVariantSchema,
  price: RulePriceSchema.optional(),
  startsAt: UpdateWindowDateSchema,
  endsAt: UpdateWindowDateSchema,
  isActive: z.boolean().optional(),
});

type RuleWindow = { startsAt?: string | null | undefined; endsAt?: string | null | undefined };

function assertWindowOrder(data: RuleWindow, ctx: z.RefinementCtx): void {
  if (
    data.startsAt &&
    data.endsAt &&
    new Date(data.endsAt).getTime() <= new Date(data.startsAt).getTime()
  ) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' });
  }
}

export const CreateCustomerPricingRuleSchema =
  CustomerPricingRuleBaseSchema.superRefine(assertWindowOrder);

export const UpdateCustomerPricingRuleSchema =
  CustomerPricingRuleUpdateBaseSchema.superRefine(assertWindowOrder);

export type CreateCustomerPricingRuleInput = z.infer<typeof CreateCustomerPricingRuleSchema>;
export type UpdateCustomerPricingRuleInput = z.infer<typeof UpdateCustomerPricingRuleSchema>;
