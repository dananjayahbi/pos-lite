import { z } from 'zod';

export const PinSchema = z
  .object({
    newPin: z
      .string()
      .regex(/^\d{4,8}$/, 'PIN must be 4 to 8 digits'),
    confirmPin: z.string(),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: 'PINs do not match',
    path: ['confirmPin'],
  });

export type PinInput = z.infer<typeof PinSchema>;
