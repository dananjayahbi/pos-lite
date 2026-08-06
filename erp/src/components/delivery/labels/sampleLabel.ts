import type { DeliveryLabelTemplate } from '@/types/delivery-label';

/** Sample address used by the label preview and "print sample". */
export const SAMPLE_ADDRESS = {
  fullName: 'Sample Customer',
  phone: '077 123 4567',
  addressLine1: '123 Main Street',
  addressLine2: 'Colombo 3',
  cityName: 'Colombo',
  districtName: 'Colombo',
  postalCode: '00100',
};

/** Sample delivery values (satisfies the minimal label input shape). */
export const SAMPLE_DELIVERY = {
  orderRef: 'ORD-00001',
  codAmount: 2500,
  itemCount: 2,
  totalWeightKg: 1.5,
  waybill: 'TE-12345678',
  address: SAMPLE_ADDRESS,
};

/** Sample extras used when rendering the label. */
export const SAMPLE_LABEL_EXTRAS = {
  waybillId: 'TE-12345678',
  origin: 'Colombo',
  pickupAddress: 'Warehouse 1, Colombo',
} as const;

/** Sample props fully assembled for direct use by `printShippingLabel`. */
export function buildSampleLabelProps(template: DeliveryLabelTemplate) {
  return {
    template,
    address: SAMPLE_ADDRESS,
    delivery: SAMPLE_DELIVERY,
    waybillId: SAMPLE_LABEL_EXTRAS.waybillId,
    origin: SAMPLE_LABEL_EXTRAS.origin,
    pickupAddress: SAMPLE_LABEL_EXTRAS.pickupAddress,
  };
}
