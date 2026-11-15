import { z } from 'zod';

import {
  DiscrepancyCategory,
  ReconciliationMatchMethod,
  ReconciliationStatus,
} from '@/generated/prisma/client';

export const ReconciliationFiltersSchema = z.object({
  status: z.nativeEnum(ReconciliationStatus).optional(),
  category: z.nativeEnum(DiscrepancyCategory).optional(),
  matchMethod: z.nativeEnum(ReconciliationMatchMethod).optional(),
  search: z.string().max(200).optional(),
  // XC-02: pagination follows the codebase-wide CLAMP policy (customers/
  // suppliers/batches/notifications) — out-of-range is corrected, not
  // rejected; malformed values still fail .int() → 400 (XC-01 contract).
  page: z.coerce.number().int().optional().default(1).transform((v) => Math.max(1, v)),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .default(50)
    .transform((v) => Math.min(200, Math.max(1, v))),
});

export type ReconciliationFilters = z.infer<typeof ReconciliationFiltersSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

/**
 * Inclusive date range for a delivery-vs-statement comparison. Both ends are
 * date-only so the UI can post plain `<input type="date">` values.
 */
export const DeliveryComparisonRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((value) => value.from <= value.to, {
    message: 'The start date must be on or before the end date',
    path: ['from'],
  });

export type DeliveryComparisonRange = z.infer<typeof DeliveryComparisonRangeSchema>;
