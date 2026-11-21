import type { DeliveryLabelTemplate } from '@/types/delivery-label';

/**
 * Fallback template. Empty fields signal the caller to use the tenant's
 * branding (the label API returns `meta.branding` and the client merges
 * name/contact; the server also fills an empty name).
 *
 * The waybill layout itself is fixed — this template only carries the sender
 * identity, so there are no colours, page sizes, or field toggles any more.
 */
export const DEFAULT_LABEL_TEMPLATE: DeliveryLabelTemplate = {
  brandName: '',
  fromContact: '',
};
