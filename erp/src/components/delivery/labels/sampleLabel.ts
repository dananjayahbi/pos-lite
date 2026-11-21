import type { DeliveryLabelTemplate } from '@/types/delivery-label';

/** Sample address used by the waybill preview and "print sample". */
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
  lines: [{ productNameSnapshot: 'Herbal Soap', skuSnapshot: 'HB-01' }],
  waybill: 'TE-12345678',
  deliveredAt: '2026-07-20T10:15:00.000Z',
  address: SAMPLE_ADDRESS,
};

/** Sample props fully assembled for direct use by `printSampleLabel`. */
export function buildSampleLabelProps(template: DeliveryLabelTemplate) {
  return {
    template,
    address: SAMPLE_ADDRESS,
    delivery: SAMPLE_DELIVERY,
    waybillId: SAMPLE_DELIVERY.waybill,
  };
}

/** A second sample so the 2-up A4 sheet can be demonstrated. */
export const SAMPLE_DELIVERY_2 = {
  orderRef: 'ORD-00002',
  codAmount: 3300,
  itemCount: 1,
  totalWeightKg: 0.5,
  lines: [{ productNameSnapshot: 'Ayurvedic Balm', skuSnapshot: 'AB-14' }],
  waybill: 'TE-12345679',
  deliveredAt: '2026-07-20T11:30:00.000Z',
  address: {
    ...SAMPLE_ADDRESS,
    fullName: 'Nimal Perera',
    phone: '071 987 6543',
    addressLine1: '45 Temple Road',
    addressLine2: 'Kandy',
    cityName: 'Kandy',
    districtName: 'Kandy',
    postalCode: '20000',
  },
};

/** Two sample labels — exactly what one printed A4 landscape sheet looks like. */
export function buildSampleSheetProps(template: DeliveryLabelTemplate) {
  return [
    buildSampleLabelProps(template),
    {
      template,
      address: SAMPLE_DELIVERY_2.address,
      delivery: SAMPLE_DELIVERY_2,
      waybillId: SAMPLE_DELIVERY_2.waybill,
    },
  ];
}
