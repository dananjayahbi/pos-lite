import 'server-only';

import { prisma } from '@/lib/prisma';
import type { TxClient } from '@/lib/services/inventory.service';
import { adjustStockInTx } from '@/lib/services/inventory.service';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { createShipment } from '@/lib/services/shipment.service';
import { autoDeductPackaging, notifyLowStock } from '@/lib/services/packaging.service';
import { resolveAdapterForAccount } from '@/lib/courier/registry';
import { toCourierOrderPayload } from '@/lib/courier/mappers';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { TERMINAL_DELIVERY_STATUSES } from '@/lib/constants/courier';
import type { RecoveryAction } from '@/generated/prisma/client';
import type {
  LogRecoveryActionInput,
  RedeliverDeliveryInput,
  PermanentCancelDeliveryInput,
} from '@/lib/validators/recovery.validators';

/**
 * Delivery recovery service — business source of truth for failed-order
 * recovery (docs 43/44/45). Wraps the (previously dead) `DeliveryRecovery`
 * model, the `RecoveryAction` enum, and the `delivery:recovery:manage`
 * permission. Every action persists a `DeliveryRecovery` row that doc 45
 * aggregates into per-staff metrics.
 */

/** Delivery statuses that can be recovered (i.e. not terminal). */
const RECOVERABLE_STATUSES = [
  'FAILED',
  'RETURNED',
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
] as const;

async function assertRecoverableDelivery(tenantId: string, deliveryId: string) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, tenantId, deletedAt: null },
  });
  if (!delivery) throw new Error('DELIVERY_NOT_FOUND');
  if (TERMINAL_DELIVERY_STATUSES.includes(delivery.status as never)) {
    throw new Error('DELIVERY_NOT_RECOVERABLE');
  }
  return delivery;
}

async function writeRecoveryRow(
  tx: TxClient,
  args: {
    tenantId: string;
    deliveryId: string;
    action: RecoveryAction;
    staffId: string;
    notes?: string | null | undefined;
    redeliveryShipmentId?: string | null | undefined;
  },
) {
  return tx.deliveryRecovery.create({
    data: {
      tenantId: args.tenantId,
      deliveryId: args.deliveryId,
      action: args.action,
      staffId: args.staffId,
      notes: args.notes ?? null,
      redeliveryShipmentId: args.redeliveryShipmentId ?? null,
    },
  });
}

/** Log a non-destructive recovery action (follow-up call or reschedule). */
export async function logRecoveryAction(
  tenantId: string,
  deliveryId: string,
  staffId: string,
  input: LogRecoveryActionInput,
) {
  setSentryTenantContext({ tenantId });
  await assertRecoverableDelivery(tenantId, deliveryId);

  const attempt = await prisma.$transaction(async (tx: TxClient) => {
    const created = await writeRecoveryRow(tx, {
      tenantId,
      deliveryId,
      action: input.action,
      staffId,
      notes: input.notes,
    });

    await tx.deliveryEvent.create({
      data: {
        tenantId,
        deliveryId,
        status: 'FAILED',
        source: 'INTERNAL',
        createdById: staffId,
        remarks:
          input.action === 'FOLLOW_UP_CALL'
            ? `Follow-up call logged${input.notes ? `: ${input.notes}` : ''}`
            : `Delivery rescheduled${input.notes ? `: ${input.notes}` : ''}`,
      },
    });

    void createAuditLog({
      tenantId,
      actorId: staffId,
      actorRole: 'UNKNOWN',
      entityType: 'Delivery',
      entityId: deliveryId,
      action: AUDIT_ACTIONS.DELIVERY_RECOVERY_LOGGED,
      after: { action: input.action, notes: input.notes ?? null },
    });

    return created;
  });

  return getRecoveryAttempts(tenantId, deliveryId);
}

/**
 * Redeliver a failed delivery: re-push a fresh courier shipment, reset the
 * delivery out of FAILED into DISPATCHED, and record a `REDELIVERED` recovery
 * row linking the new shipment id.
 */
export async function redeliverDelivery(
  tenantId: string,
  deliveryId: string,
  staffId: string,
  input: RedeliverDeliveryInput,
) {
  setSentryTenantContext({ tenantId });

  const existing = await prisma.delivery.findFirst({
    where: { id: deliveryId, tenantId, deletedAt: null },
    include: { address: true },
  });
  if (!existing) throw new Error('DELIVERY_NOT_FOUND');
  if (!(RECOVERABLE_STATUSES as readonly string[]).includes(existing.status)) {
    throw new Error('DELIVERY_NOT_RECOVERABLE');
  }
  if (!existing.address) throw new Error('DELIVERY_MISSING_ADDRESS');

  const account = await prisma.courierAccount.findFirst({ where: { tenantId } });
  if (!account?.isActive) throw new Error('COURIER_ACCOUNT_NOT_CONFIGURED');

  const adapter = resolveAdapterForAccount(account);
  const auth = await adapter.authenticate({
    email: account.email ?? undefined,
    password: account.password ?? undefined,
    apiKey: account.apiKey ?? undefined,
    env: account.env,
  });
  if (!auth.ok) throw new Error(`COURIER_AUTH_FAILED:${auth.error.message}`);

  const payload = toCourierOrderPayload(
    {
      fullName: existing.address.fullName,
      phone: existing.address.phone,
      phone2: existing.address.phone2,
      addressLine1: existing.address.addressLine1,
      addressLine2: existing.address.addressLine2,
      cityId: existing.address.cityId,
      cityName: existing.address.cityName,
      districtId: existing.address.districtId,
    },
    {
      orderRef: existing.orderRef,
      codAmount: existing.codAmount,
      notes: existing.notes,
      itemCount: existing.itemCount,
    },
    { waybillId: input.waybillMode === 'MANUAL' ? input.manualWaybillId : undefined },
  );

  const upload = await adapter.uploadSingle(account.env, auth.data, {
    waybillMode: input.waybillMode,
    payload,
  });
  if (!upload.ok) throw new Error(`COURIER_UPLOAD_FAILED:${upload.error.message}`);

  const dispatched = await prisma.$transaction(async (tx: TxClient) => {
    const updated = await tx.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'DISPATCHED',
        courierOrderRef: existing.orderRef,
        dispatchedAt: new Date(),
        holdExpiresAt: null,
        failureReason: null,
      },
    });

    const shipment = await createShipment({
      tenantId,
      deliveryId,
      env: account.env,
      waybillId: upload.data.waybillId,
      waybillMode: input.waybillMode,
      courierOrderId: upload.data.courierOrderId,
      lastRawResponse: upload.data.raw,
      tx,
    });

    await writeRecoveryRow(tx, {
      tenantId,
      deliveryId,
      action: 'REDELIVERED',
      staffId,
      notes: input.notes,
      redeliveryShipmentId: shipment.id,
    });

    await tx.deliveryEvent.create({
      data: {
        tenantId,
        deliveryId,
        status: 'DISPATCHED',
        source: 'INTERNAL',
        createdById: staffId,
        remarks: `Redelivered (${input.waybillMode}) waybill ${upload.data.waybillId}`,
      },
    });

    void createAuditLog({
      tenantId,
      actorId: staffId,
      actorRole: 'UNKNOWN',
      entityType: 'Delivery',
      entityId: deliveryId,
      action: AUDIT_ACTIONS.DELIVERY_REDELIVERED,
      after: { waybillId: upload.data.waybillId, waybillMode: input.waybillMode },
    });

    return updated;
  });

  // Non-blocking packaging deduction for the new shipment.
  const deductions = await autoDeductPackaging(tenantId, deliveryId);
  if (deductions.length > 0) {
    await notifyLowStock(tenantId, deliveryId, deductions);
  }

  void createRedeliveryNotification(tenantId, deliveryId, existing.orderRef);

  return getDeliveryWithAttempts(tenantId, dispatched.id);
}

/**
 * Permanently cancel a failed delivery: set CANCELED, restock inventory from
 * the linked sale's lines, and reverse packaging consumption. Records a
 * `CANCELLED` recovery row.
 */
export async function permanentlyCancelDelivery(
  tenantId: string,
  deliveryId: string,
  staffId: string,
  input: PermanentCancelDeliveryInput,
) {
  setSentryTenantContext({ tenantId });

  const existing = await prisma.delivery.findFirst({
    where: { id: deliveryId, tenantId, deletedAt: null },
    include: {
      sale: { include: { lines: { select: { variantId: true, quantity: true } } } },
      packagingConsumptions: { select: { packagingItemId: true, quantity: true } },
    },
  });
  if (!existing) throw new Error('DELIVERY_NOT_FOUND');
  if (!(RECOVERABLE_STATUSES as readonly string[]).includes(existing.status)) {
    throw new Error('DELIVERY_NOT_RECOVERABLE');
  }

  const canceled = await prisma.$transaction(async (tx: TxClient) => {
    // Restock inventory from the linked sale (reverse the original deduction).
    if (existing.sale?.lines.length) {
      for (const line of existing.sale.lines) {
        await adjustStockInTx(tx, tenantId, line.variantId, staffId, {
          quantityDelta: line.quantity,
          reason: 'VOID_REVERSAL',
          note: `Restock from cancelled delivery ${existing.orderRef}`,
          saleId: existing.saleId ?? undefined,
        });
      }
    }

    // Reverse packaging consumption back onto the packaging items.
    for (const consumption of existing.packagingConsumptions) {
      await tx.packagingItem.update({
        where: { id: consumption.packagingItemId },
        data: { quantityOnHand: { increment: consumption.quantity.toNumber() } },
      });
    }

    const updated = await tx.delivery.update({
      where: { id: deliveryId },
      data: { status: 'CANCELED', canceledAt: new Date(), canceledById: staffId },
    });

    await writeRecoveryRow(tx, {
      tenantId,
      deliveryId,
      action: 'CANCELLED',
      staffId,
      notes: input.notes ?? input.reason,
    });

    await tx.deliveryEvent.create({
      data: {
        tenantId,
        deliveryId,
        status: 'CANCELED',
        source: 'USER',
        createdById: staffId,
        remarks: input.reason ?? 'Permanently cancelled after failed delivery',
      },
    });

    void createAuditLog({
      tenantId,
      actorId: staffId,
      actorRole: 'UNKNOWN',
      entityType: 'Delivery',
      entityId: deliveryId,
      action: AUDIT_ACTIONS.DELIVERY_RECOVERY_CANCELLED,
      after: { reason: input.reason ?? null },
    });

    return updated;
  });

  return getDeliveryWithAttempts(tenantId, canceled.id);
}

/** Full recovery attempt history for a delivery (doc 45 step 4). */
export async function getRecoveryAttempts(tenantId: string, deliveryId: string) {
  return prisma.deliveryRecovery.findMany({
    where: { tenantId, deliveryId },
    orderBy: { createdAt: 'asc' },
    include: { staff: { select: { id: true, email: true } } },
  });
}

async function getDeliveryWithAttempts(tenantId: string, deliveryId: string) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, tenantId, deletedAt: null },
    include: {
      address: true,
      customer: { select: { id: true, name: true, phone: true } },
      shipments: { orderBy: { createdAt: 'desc' as const } },
      events: { orderBy: { eventAt: 'asc' as const }, take: 50 },
      sale: { select: { id: true, totalAmount: true, status: true } },
      attempts: {
        orderBy: { createdAt: 'asc' as const },
        include: { staff: { select: { id: true, email: true } } },
      },
    },
  });
  if (!delivery) throw new Error('DELIVERY_NOT_FOUND');
  return delivery;
}

async function createRedeliveryNotification(
  tenantId: string,
  deliveryId: string,
  orderRef: string,
): Promise<void> {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (recipients.length === 0) return;
    await prisma.notificationRecord.createMany({
      data: recipients.map((r) => ({
        tenantId,
        recipientId: r.id,
        type: 'DELIVERY_DISPATCHED' as const,
        title: 'Delivery redelivered',
        body: `Order ${orderRef} redelivered after failed attempt`,
        relatedEntityType: 'Delivery',
        relatedEntityId: deliveryId,
      })),
    });
  } catch (error) {
    console.warn('Redelivery notification failed:', error);
  }
}
