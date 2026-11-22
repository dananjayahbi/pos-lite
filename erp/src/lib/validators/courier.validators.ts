import { z } from 'zod';

import { CourierEnv } from '@/generated/prisma/client';

/**
 * Nullable origin id. An empty string or null means "clear the stored value";
 * numeric strings from older clients are still coerced.
 */
const nullableOriginId = z
  .preprocess(
    (value) => (value === '' || value === null ? null : value),
    z.union([z.null(), z.coerce.number().int()]),
  )
  .optional();

/** Courier account (Trans Express) settings schema. */
export const CourierSettingsSchema = z.object({
  env: z.nativeEnum(CourierEnv).default('STAGING'),
  // ARGUS #513: null/'' are explicit clears, not "omit and keep the old value".
  email: z.string().email().nullable().optional().or(z.literal('')),
  password: z.string().min(1).optional().or(z.literal('')),
  apiKey: z.string().min(1).optional().or(z.literal('')),
  originDistrictId: nullableOriginId,
  originCityId: nullableOriginId,
  pickupAddress: z.string().max(255).nullable().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export type CourierSettingsInput = z.infer<typeof CourierSettingsSchema>;

/**
 * Dry-run credentials for "Test connection" / "Sync locations" (ARGUS #513).
 * Nothing here is persisted; omitted secrets fall back to the saved account.
 */
export const CourierTestSchema = z.object({
  env: z.nativeEnum(CourierEnv).optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  password: z.string().min(1).optional().or(z.literal('')),
  apiKey: z.string().min(1).optional().or(z.literal('')),
});

export type CourierTestInput = z.infer<typeof CourierTestSchema>;
