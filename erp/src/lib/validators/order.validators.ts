import { z } from 'zod';

import { DELIVERY_STATUSES } from '@/lib/validators/delivery.validators';

/** Bulk status change on selected order deliveries. */
export const BulkStatusChangeSchema = z.object({
  deliveryIds: z.array(z.string().min(1)).min(1).max(200),
  status: z.enum(DELIVERY_STATUSES),
});

/** Bulk "prepare for delivery" on selected order deliveries. */
export const BulkCreateDeliverySchema = z.object({
  deliveryIds: z.array(z.string().min(1)).min(1).max(200),
});

export type BulkStatusChangeInput = z.infer<typeof BulkStatusChangeSchema>;
export type BulkCreateDeliveryInput = z.infer<typeof BulkCreateDeliverySchema>;

/** Per-id result for bulk operations. */
export interface BulkResultItem {
  id: string;
  ok: boolean;
  message?: string;
}
