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
  // Secondary contact is optional. An untouched input submits '', which is
  // accepted; a non-empty value must still be a valid Sri Lankan number.
  phone2: z.union([z.literal(''), zSriLankaPhone()]).optional(),
  // Customer card address / city. `city` is chosen from the tenant's Trans
  // Express master list in the UI, but the API accepts the resolved text so
  // current rows and fallback lists keep working.
  address: z.string().trim().max(250, 'Address must be 250 characters or fewer').optional(),
  city: z.string().trim().max(100, 'City must be 100 characters or fewer').optional(),
  // M05-01 (BUG-25): an untouched optional Email input submits ''; accept it
  // and normalize to null so an edit can clear the field. A malformed
  // non-empty email still 400s.
  email: z
    .union([
      z.literal(''),
      z.null(),
      z.string().trim().toLowerCase().email('Invalid email address').max(100),
    ])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v)),
  gender: z.nativeEnum(GenderEnum, { error: 'Invalid gender' }).optional(),
  // M05-02 (BUG-26/29): '' / null → null ("no birthday") so the edit form can
  // clear it; any non-empty value must parse to a real date.
  birthday: z
    .union([
      z.literal(''),
      z.null(),
      z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), 'Invalid date'),
    ])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : v)),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
