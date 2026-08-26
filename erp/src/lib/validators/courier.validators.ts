import { z } from 'zod';

import { CourierEnv } from '@/generated/prisma/client';

/** Courier account (Trans Express) settings schema. */
export const CourierSettingsSchema = z.object({
  env: z.nativeEnum(CourierEnv).default('STAGING'),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(1).optional().or(z.literal('')),
  apiKey: z.string().min(1).optional().or(z.literal('')),
  originDistrictId: z.coerce.number().int().optional(),
  originCityId: z.coerce.number().int().optional(),
  pickupAddress: z.string().max(255).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export type CourierSettingsInput = z.infer<typeof CourierSettingsSchema>;
