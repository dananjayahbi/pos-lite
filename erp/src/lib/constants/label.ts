import type { DeliveryLabelTemplate } from '@/types/delivery-label';

/**
 * Fallback template. An empty brandName signals the renderer to use the
 * tenant's branding name (resolved server-side in `label.service.ts`).
 *
 * The waybill layout itself is fixed — this template only carries the sender
 * identity, so there are no colours, page sizes, or field toggles any more.
 */
export const DEFAULT_LABEL_TEMPLATE: DeliveryLabelTemplate = {
  brandName: '',
  fromContact: '',
};
