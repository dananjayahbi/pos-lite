import 'server-only';

import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { updateShipmentStatus } from '@/lib/services/shipment.service';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { transExpressAdapter } from '@/lib/courier';
import {
  TRANSEXPRESS_STATUS_MAP,
  TERMINAL_DELIVERY_STATUSES,
  MIN_TRACKING_INTERVAL_MS,
  TRACKING_BATCH_SIZE,
} from '@/lib/constants/courier';
import type { CourierTracking } from '@/lib/courier/types';
import type { DeliveryStatus, ShipmentStatus } from '@/generated/prisma/client';

/**
 * Tracking service — the no-webhook substitute. A cron route calls
 * processDueTrackingChecks() which polls non-terminal shipments in throttled
 * batches, diffs statuses, writes events, and triggers side effects.
 */

function mapStatus(raw: string | undefined): { shipment: ShipmentStatus; delivery: DeliveryStatus } {
  if (!raw) return { shipment: 'PROCESSING', delivery: 'IN_TRANSIT' };
  const normalized = raw.trim().toLowerCase();
  return TRANSEXPRESS_STATUS_MAP[normalized] ?? { shipment: 'PROCESSING', delivery: 'IN_TRANSIT' };
}

/**
 * Apply a single tracking payload to a shipment + delivery.
 * Idempotent: only inserts NEW events (dedup by name + eventAt) and advances
 * the delivery status to the mapped business status.
 */
export async function applyTrackingUpdate(
  shipmentId: string,
  deliveryId: string,
  tenantId: string,
  tracking: CourierTracking,
): Promise<{ changed: boolean; deliveryStatus: DeliveryStatus }> {
  setSentryTenantContext({ tenantId });

  const shipment = await prisma.courierShipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) return { changed: false, deliveryStatus: 'IN_TRANSIT' };

  const mapped = mapStatus(tracking.currentStatus);
  const existingEvents = await prisma.deliveryEvent.findMany({
    where: { shipmentId },
    select: { rawStatusName: true, eventAt: true },
  });
  const existingKeys = new Set(
    existingEvents.map((e) => `${e.rawStatusName ?? ''}|${e.eventAt?.toISOString() ?? ''}`),
  );

  // Insert new history events (dedup by name + timestamp).
  const newEvents = tracking.statusHistory.filter(
    (h) => !existingKeys.has(`${h.name}|${h.addedDate ? new Date(h.addedDate).toISOString() : ''}`),
  );

  const changed = newEvents.length > 0 || shipment.status !== mapped.shipment;

  await prisma.$transaction(async (tx) => {
    await updateShipmentStatus(
      { id: shipmentId, deliveryId },
      {
        status: mapped.shipment,
        rawStatus: tracking.currentStatus ?? shipment.rawStatus,
        hubWeightKg: tracking.weightKg !== undefined ? String(tracking.weightKg) : undefined,
        deliveredAt: mapped.delivery === 'DELIVERED' ? new Date() : undefined,
        failureReason: mapped.delivery === 'FAILED' ? tracking.statusHistory.at(-1)?.remarks : undefined,
      },
      { tx },
    );

    await tx.courierShipment.update({
      where: { id: shipmentId },
      data: { lastRawResponse: tracking.raw as never, carrierLastSyncedAt: new Date() },
    });

    if (newEvents.length > 0) {
      await tx.deliveryEvent.createMany({
        data: newEvents.map((h) => ({
          tenantId,
          deliveryId,
          shipmentId,
          status: mapped.delivery,
          carrierStatus: mapped.shipment,
          rawStatusName: h.name,
          remarks: h.remarks ?? null,
          eventAt: h.addedDate ? new Date(h.addedDate) : new Date(),
          source: 'CARRIER',
        })),
      });
    }

    // Advance the delivery business status (never regress from a terminal state).
    const delivery = await tx.delivery.findUnique({ where: { id: deliveryId } });
    if (delivery && !TERMINAL_DELIVERY_STATUSES.includes(delivery.status as DeliveryStatus)) {
      if (mapped.delivery !== delivery.status) {
        await tx.delivery.update({
          where: { id: deliveryId },
          data: {
            status: mapped.delivery,
            ...(mapped.delivery === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
          },
        });

        if (mapped.delivery === 'DELIVERED') {
          // Create the expected-receivables ledger entry (PENDING_SETTLEMENT).
          await tx.reconciliationLedgerEntry.upsert({
            where: { deliveryId },
            create: {
              tenantId,
              deliveryId,
              waybillId: shipment.waybillId,
              expectedCod: delivery.codAmount,
              status: 'PENDING_SETTLEMENT',
            },
            update: {},
          });
        }
      }
    }
  });

  if (changed) {
    void createAuditLog({
      tenantId,
      actorId: null,
      actorRole: 'SYSTEM',
      entityType: 'CourierShipment',
      entityId: shipmentId,
      action: AUDIT_ACTIONS.DELIVERY_STATUS_CHANGED,
      after: { shipmentStatus: mapped.shipment, deliveryStatus: mapped.delivery },
    });
  }

  return { changed, deliveryStatus: mapped.delivery };
}

/** Poll due non-terminal shipments in bounded, per-tenant batches. */
export async function processDueTrackingChecks(): Promise<{ processed: number; failed: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - MIN_TRACKING_INTERVAL_MS);

  const due = await prisma.courierShipment.findMany({
    where: {
      status: { notIn: ['DELIVERED', 'CANCELED', 'RETURNED'] },
      OR: [{ carrierLastSyncedAt: null }, { carrierLastSyncedAt: { lt: cutoff } }],
    },
    include: { delivery: { select: { id: true, tenantId: true } } },
    orderBy: { carrierLastSyncedAt: 'asc' },
    take: TRACKING_BATCH_SIZE,
  });

  // Group by tenant so each tenant authenticates at most once per run.
  const tenantIds = Array.from(new Set(due.map((s) => s.delivery.tenantId)));
  const tokensByTenant = new Map<string, string>();

  for (const tenantId of tenantIds) {
    const account = await prisma.courierAccount.findFirst({ where: { tenantId, isActive: true } });
    if (!account) continue;
    const auth = await transExpressAdapter.authenticate({
      email: account.email ?? undefined,
      password: account.password ?? undefined,
      apiKey: account.apiKey ?? undefined,
      env: account.env,
    });
    if (auth.ok) tokensByTenant.set(tenantId, auth.data);
  }

  let processed = 0;
  let failed = 0;

  for (const shipment of due) {
    const token = tokensByTenant.get(shipment.delivery.tenantId);
    if (!token) {
      failed++;
      continue;
    }

    const result = await transExpressAdapter.track(shipment.env, token, shipment.waybillId);
    if (!result.ok) {
      failed++;
      continue;
    }

    await applyTrackingUpdate(shipment.id, shipment.deliveryId, shipment.delivery.tenantId, result.data);
    processed++;
  }

  return { processed, failed };
}

/** Export a helper for the "is terminal" check used by callers. */
export { isTerminalShipmentStatus } from '@/lib/services/shipment.service';
