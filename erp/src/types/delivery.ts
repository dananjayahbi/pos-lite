import type {
  CourierEnv,
  CourierShipment,
  DeliverySource,
  DeliveryStatus,
  WaybillMode,
} from '@/generated/prisma/client';

/** Minimal customer snapshot used on delivery records. */
export interface DeliveryCustomer {
  id: string;
  name: string;
  phone: string;
}

/** Shipping address snapshot carried by a delivery. */
export interface DeliveryAddress {
  id?: string;
  fullName: string;
  phone: string;
  phone2?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  districtId?: number | null;
  districtName?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  postalCode?: string | null;
}

/** Status-history event on a delivery. */
export interface DeliveryEvent {
  id?: string;
  status: DeliveryStatus;
  carrierStatus?: string | null;
  rawStatusName?: string | null;
  remarks?: string | null;
  eventAt: string;
  source: string;
}

/** A courier shipment (waybill) projection on a delivery. */
export interface DeliveryShipment {
  id: string;
  waybillId: string;
  waybillMode: WaybillMode;
  status: string;
  rawStatus?: string | null;
  env: CourierEnv;
  carrierLastSyncedAt?: string | null;
  courierOrderId?: string | null;
}

/** A single failed-order recovery attempt (doc 44/45). */
export interface DeliveryRecoveryAttempt {
  id: string;
  action: 'FOLLOW_UP_CALL' | 'RESCHEDULED' | 'REDELIVERED' | 'CANCELLED';
  notes?: string | null;
  redeliveryShipmentId?: string | null;
  createdAt: string;
  staff?: { id: string; email: string } | null;
}

/** Full delivery detail payload returned by /api/store/deliveries/[id]. */
export interface DeliveryDetail {
  id: string;
  orderRef: string;
  source: DeliverySource;
  status: DeliveryStatus;
  codAmount: number | string;
  declaredValue?: number | string | null;
  itemCount: number;
  totalWeightKg?: number | string | null;
  hubWeightKg?: number | string | null;
  shippingFee?: number | string | null;
  deliveryFee?: number | string | null;
  holdExpiresAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  waybill?: string | null;
  address?: DeliveryAddress | null;
  customer?: DeliveryCustomer | null;
  shipments?: DeliveryShipment[];
  events?: DeliveryEvent[];
  attempts?: DeliveryRecoveryAttempt[];
}

/** A single row in the delivery list. */
export interface DeliveryListItem {
  id: string;
  orderRef: string;
  source: DeliverySource;
  status: DeliveryStatus;
  codAmount: number | string;
  shippingFee?: number | string | null;
  totalWeightKg?: number | string | null;
  itemCount: number;
  dispatchedAt?: string | null;
  failureReason?: string | null;
  waybill?: string | null;
  address?: DeliveryAddress | null;
  customer?: DeliveryCustomer | null;
  shipments?: DeliveryShipment[];
}

export type { CourierShipment };
