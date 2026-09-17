import { z } from 'zod';
import { zSriLankaPhone } from '@/lib/validators/shared';

// Uses the Gender enum values from Prisma schema
// After `prisma generate`, these match the `Gender` enum from @/generated/prisma/client
const GenderEnum = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' } as const;

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  // M14-03 (req 2.2): SL mobile format, separators stripped, normalised to
  // +94XXXXXXXXX for storage. Validation is create/update-input only — legacy
  // rows are untouched; normalization unifies 077…/+9477… under
  // @@unique([tenantId, phone]).
  phone: zSriLankaPhone(),
  // M05-01 (BUG-25): an untouched optional Email input submits ''; accept it
  // and normalize to undefined. A malformed non-empty email still 400s.
  email: z
    .union([z.literal(''), z.string().trim().toLowerCase().email('Invalid email address').max(100)])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  gender: z.nativeEnum(GenderEnum, { error: 'Invalid gender' }).optional(),
  // M05-02 (BUG-26/29): '' → undefined ("no birthday"); any non-empty value
  // must parse to a real date or the request is rejected 400 VALIDATION_ERROR
  // instead of reaching Prisma as an Invalid Date.
  birthday: z
    .union([
      z.literal(''),
      z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Invalid date'),
    ])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
