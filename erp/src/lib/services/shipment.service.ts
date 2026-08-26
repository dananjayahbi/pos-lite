import 'server-only';

import { prisma } from '@/lib/prisma';
import type { TxClient } from '@/lib/services/inventory.service';
import type { CourierEnv, CourierShipment, ShipmentStatus, WaybillMode } from '@/generated/prisma/client';
import { TERMINAL_SHIPMENT_STATUSES } from '@/lib/constants/courier';

/**
 * Shipment service: persists the CourierShipment (carrier projection) and diffs
 * status history into DeliveryEvent rows. It is the single writer for waybills.
 */

export interface CreateShipmentInput {
  deliveryId: string;
  tenantId: string;
  env: CourierEnv;
  waybillId: string;
  waybillMode: WaybillMode;
  courierOrderId?: string | null | undefined;
  rawStatus?: string | null | undefined;
  lastRawResponse?: unknown;
  tx?: TxClient | undefined;
}

/** Create a CourierShipment within an optional transaction. */
export async function createShipment(input: CreateShipmentInput): Promise<CourierShipment> {
  const client = input.tx ?? prisma;
  return client.courierShipment.create({
    data: {
      deliveryId: input.deliveryId,
      tenantId: input.tenantId,
      env: input.env,
      waybillId: input.waybillId,
      waybillMode: input.waybillMode,
      courierOrderId: input.courierOrderId ?? null,
      rawStatus: input.rawStatus ?? null,
      lastRawResponse: input.lastRawResponse as never,
      carrierLastSyncedAt: new Date(),
      latestEventAt: new Date(),
    },
  });
}

export interface ShipmentWithDelivery {
  id: string;
  tenantId: string;
  deliveryId: string;
  env: CourierEnv;
  waybillId: string;
  status: ShipmentStatus;
  rawStatus: string | null;
  courierOrderId: string | null;
  carrierLastSyncedAt: Date | null;
  latestEventAt: Date | null;
  lastRawResponse: unknown;
  delivery: {
    id: string;
    codAmount: { toString(): string };
    deliveredAt: Date | null;
  };
}

/** Update a shipment's status + denormalized fields. */
export async function updateShipmentStatus(
  shipment: { id: string; deliveryId: string },
  data: {
    status: ShipmentStatus;
    rawStatus?: string | null | undefined;
    hubWeightKg?: string | number | null | undefined;
    deliveredAt?: Date | null | undefined;
    failureReason?: string | null | undefined;
  },
  opts?: { tx?: TxClient | undefined },
): Promise<void> {
  const client = opts?.tx ?? prisma;
  await client.courierShipment.update({
    where: { id: shipment.id },
    data: {
      status: data.status,
      carrierLastSyncedAt: new Date(),
      latestEventAt: new Date(),
      ...(data.rawStatus !== undefined ? { rawStatus: data.rawStatus } : {}),
    },
  });

  if (data.hubWeightKg !== undefined || data.deliveredAt !== undefined || data.failureReason !== undefined) {
    await client.delivery.update({
      where: { id: shipment.deliveryId },
      data: {
        ...(data.hubWeightKg !== undefined && data.hubWeightKg !== null ? { hubWeightKg: data.hubWeightKg } : {}),
        ...(data.deliveredAt ? { deliveredAt: data.deliveredAt } : {}),
        ...(data.failureReason !== undefined ? { failureReason: data.failureReason } : {}),
      },
    });
  }
}

/** True when a shipment status is terminal (poller should skip). */
export function isTerminalShipmentStatus(status: ShipmentStatus): boolean {
  return TERMINAL_SHIPMENT_STATUSES.includes(status);
}
