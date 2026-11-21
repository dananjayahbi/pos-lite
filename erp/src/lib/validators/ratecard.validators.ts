import { z } from 'zod';

import { MAX_RATE_AMOUNT, MAX_RATE_WEIGHT_KG } from '@/lib/delivery/rateCardQuote.core';

const rateAmount = z.coerce
  .number()
  .nonnegative()
  .max(MAX_RATE_AMOUNT, `Rate cannot exceed ${MAX_RATE_AMOUNT}`);
const percent = z.coerce.number().nonnegative().max(100, 'Percentage cannot exceed 100');

export const UpsertRateCardSchema = z.object({
  name: z.string().min(1, 'Rate card name is required').max(120).optional(),
  isActive: z.boolean().optional(),
  baseRate: rateAmount.optional(),
  extraKgRate: rateAmount.optional(),
  freeBaseWeightKg: z.coerce.number().nonnegative().max(MAX_RATE_WEIGHT_KG).optional(),
  coddCommissionPct: percent.optional(),
  vatRatePct: percent.optional(),
});

export const RateCardEntrySchema = z
  .object({
    id: z.string().cuid().optional(), // present when updating an existing entry
    originDistrictId: z.coerce.number().int().nullable().optional(),
    destinationDistrictId: z.coerce.number().int().nullable().optional(),
    destinationCityId: z.coerce.number().int().nullable().optional(),
    baseRate: rateAmount.nullable().optional(),
    extraKgRate: rateAmount.nullable().optional(),
  })
  // ARGUS #290: the pricing engine has no origin input, so an origin-scoped
  // row would silently apply to every origin. Refuse it instead.
  .refine(
    (entry) => entry.originDistrictId === null || entry.originDistrictId === undefined,
    {
      message:
        'Origin-specific rates are not supported. Leave origin empty; zone rates match the destination only.',
      path: ['originDistrictId'],
    },
  );

export const UpsertRateCardEntriesSchema = z.object({
  entries: z.array(RateCardEntrySchema).max(200),
});

export type UpsertRateCardInput = z.infer<typeof UpsertRateCardSchema>;
export type UpsertRateCardEntriesInput = z.infer<typeof UpsertRateCardEntriesSchema>;
