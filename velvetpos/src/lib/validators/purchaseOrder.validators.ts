import { z } from 'zod';

const POStatusEnum = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export const CreatePOLineSchema = z.object({
  variantId: z.string().min(1, 'Variant is required'),
  orderedQty: z.int().min(1, 'Quantity must be at least 1'),
  expectedCostPrice: z.number().min(0, 'Cost price must be non-negative'),
});

export const CreatePOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  lines: z.array(CreatePOLineSchema).min(1, 'At least one line is required'),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const ReceivePOLineSchema = z.object({
  lineId: z.string().min(1, 'Line ID is required'),
  receivedQty: z.int().min(1, 'Received quantity must be at least 1'),
  actualCostPrice: z.number().min(0).optional(),
});

export const ReceivePOLinesSchema = z.object({
  receivedLines: z.array(ReceivePOLineSchema).min(1, 'At least one line must be received'),
});

export const UpdatePOStatusSchema = z.object({
  status: z.nativeEnum(POStatusEnum, { error: 'Invalid status' }),
});

export type CreatePOInput = z.infer<typeof CreatePOSchema>;
export type ReceivePOLinesInput = z.infer<typeof ReceivePOLinesSchema>;
export type UpdatePOStatusInput = z.infer<typeof UpdatePOStatusSchema>;
