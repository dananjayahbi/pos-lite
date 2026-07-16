import { z } from 'zod';

// Uses the Gender enum values from Prisma schema
// After `prisma generate`, these match the `Gender` enum from @/generated/prisma/client
const GenderEnum = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' } as const;

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().email().max(100).optional(),
  gender: z.nativeEnum(GenderEnum, { error: 'Invalid gender' }).optional(),
  birthday: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
