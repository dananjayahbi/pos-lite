import { z } from 'zod';

import { ReconciliationStatus } from '@/generated/prisma/client';

export const ReconciliationFiltersSchema = z.object({
  status: z.nativeEnum(ReconciliationStatus).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type ReconciliationFilters = z.infer<typeof ReconciliationFiltersSchema>;
