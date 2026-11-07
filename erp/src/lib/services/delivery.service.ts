import 'server-only';

import Decimal from 'decimal.js';

import { Prisma } from '@/generated/prisma/client';
import type { StockMovementReason } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { setSentryTenantContext } from '@/lib/sentry/context';
import type { TxClient } from '@/lib/services/inventory.service';
import { calculateShippingFee } from '@/lib/services/rate-engine.service';
import { createShipment } from '@/lib/services/shipment.service';
import { autoDeductPackaging, notifyLowStock } from '@/lib/services/packaging.service';
import { resolveAdapterForAccount } from '@/lib/courier/registry';
import { toCourierOrderPayload } from '@/lib/courier/mappers';
import { HOLD_BUFFER_DURATION_MS, TERMINAL_SHIPMENT_STATUSES } from '@/lib/constants/courier';
import type {
  CancelDeliveryInput,
  CreateDeliveryInput,
  DeliveryFilters,
  DispatchDeliveryInput,
  UpdateDeliveryInput,
} from '@/lib/validators/delivery.validators';

/**
 * Delivery service — business source of truth for the dispatch pipeline:
 * create → PLACED → PENDING_DISPATCH (hold buffer) → DISPATCHED → tracked.
 */

const deliveryInclude = {
  address: true,
  customer: { select: { id: true, name: true, phone: true } },
  // M28-01: website orders persist their reserved line items; the detail view
  // (and the cancel-restock path) needs them, so they ride the standard include.
  lines: { orderBy: { createdAt: 'asc' as const } },
  shipments: { orderBy: { createdAt: 'desc' as const } },
  events: { orderBy: { eventAt: 'desc' as const }, take: 50 },
  sale: { select: { id: true, totalAmount: true, status: true } },
  attempts: {
    orderBy: { createdAt: 'asc' as const },
    include: { staff: { select: { id: true, email: true } } },
  },
} as const;

/**
 * Allocate the next manual delivery reference for a tenant+year.
 *
 * M28-02/BUG-98 parity: the website checkout path already serializes refs via
 * `OrderRefCounter`; manual deliveries used `count() + 1`, which races and hits
 * the `Delivery(tenantId, orderRef)` unique constraint. Runs inside the create
 * transaction so concurrent creates serialize.
 */
async function generateOrderRef(tx: TxClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await tx.orderRefCounter.upsert({
    where: { tenantId_year: { tenantId, year } },
    create: { tenantId, year, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  return `DEL-${year}-${String(counter.lastSeq).padStart(6, '0')}`;
}

export async function getDeliveries(tenantId: string, filters: DeliveryFilters) {
  const { status, source, search, dateFrom, dateTo, page, limit } = filters;

  const where: Prisma.DeliveryWhereInput = { tenantId, deletedAt: null };
  if (status) where.status = status;
  if (source) where.source = source;
  if (search) {
    where.OR = [
      { orderRef: { contains: search, mode: 'insensitive' } },
      { courierOrderRef: { contains: search, mode: 'insensitive' } },
      { address: { fullName: { contains: search, mode: 'insensitive' } } },
      { shipments: { some: { waybillId: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [total, items] = await Promise.all([
    prisma.delivery.count({ where }),
    prisma.delivery.findMany({
      where,
      include: {
        address: true,
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { items, total, page, limit };
}

export async function getDeliveryById(tenantId: string, id: string) {
  const delivery = await prisma.delivery.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: deliveryInclude,
  });
  if (!delivery) throw new Error('DELIVERY_NOT_FOUND');
  return delivery;
}

export async function createDelivery(
  tenantId: string,
  userId: string,
  input: CreateDeliveryInput,
): Promise<unknown> {
  setSentryTenantContext({ tenantId });

  const codAmount = new Decimal(input.codAmount?.toString() ?? '0');
  const totalWeightKg = input.totalWeightKg !== undefined ? new Decimal(input.totalWeightKg.toString()) : undefined;

  // Never trust caller-supplied foreign keys: a delivery must not be able to
  // link (and then expose) another tenant's customer or sale.
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, tenantId },
      select: { id: true },
    });
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND');
  }
  if (input.saleId) {
    const sale = await prisma.sale.findFirst({
      where: { id: input.saleId, tenantId },
      select: { id: true },
    });
    if (!sale) throw new Error('SALE_NOT_FOUND');
  }

  // Compute the shipping fee from the active rate card (server-side only).
  const fee = await calculateShippingFee({
    tenantId,
    weightKg: totalWeightKg,
    destinationDistrictId: input.address.districtId,
    destinationCityId: input.address.cityId,
  });

  const holdExpiresAt = new Date(Date.now() + HOLD_BUFFER_DURATION_MS);

  const delivery = await prisma.$transaction(async (tx: TxClient) => {
    const orderRef = await generateOrderRef(tx, tenantId);
    const created = await tx.delivery.create({
      data: {
        tenantId,
        source: input.source ?? 'ERP_MANUAL',
        status: 'PENDING_DISPATCH',
        orderRef,
        customerId: input.customerId ?? null,
        saleId: input.saleId ?? null,
        codAmount: codAmount.toFixed(2),
        declaredValue: input.declaredValue ?? null,
        itemCount: input.itemCount ?? 1,
        totalWeightKg: totalWeightKg?.toFixed(2) ?? null,
        shippingFee: fee.shippingFee.toFixed(2),
        notes: input.notes ?? null,
        assignedStaffId: input.assignedStaffId ?? null,
        holdExpiresAt,
      },
      include: { address: true },
    });

    const address = await tx.shippingAddress.create({
      data: {
        tenantId,
        customerId: input.customerId ?? null,
        fullName: input.address.fullName,
        phone: input.address.phone,
        phone2: input.address.phone2 ?? null,
        addressLine1: input.address.addressLine1,
        addressLine2: input.address.addressLine2 ?? null,
        districtId: input.address.districtId ?? null,
        districtName: input.address.districtName ?? null,
        cityId: input.address.cityId ?? null,
        cityName: input.address.cityName,
        postalCode: input.address.postalCode ?? null,
      },
    });

    await tx.delivery.update({
      where: { id: created.id },
      data: { addressId: address.id },
    });

    await tx.deliveryEvent.create({
      data: {
        tenantId,
        deliveryId: created.id,
        status: 'PENDING_DISPATCH',
        source: 'INTERNAL',
        createdById: userId,
        remarks: 'Delivery created',
      },
    });

    await createAuditLog({
      tenantId,
      actorId: userId,
      actorRole: 'UNKNOWN',
      entityType: 'Delivery',
      entityId: created.id,
      action: AUDIT_ACTIONS.DELIVERY_CREATED,
      after: { orderRef, codAmount: codAmount.toFixed(2), status: 'PENDING_DISPATCH' },
    });

    return created;
  });

  return getDeliveryById(tenantId, delivery.id);
}

export async function updateDelivery(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateDeliveryInput,
): Promise<unknown> {
  setSentryTenantContext({ tenantId });

  const existing = await prisma.delivery.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { address: true },
  });
  if (!existing) throw new Error('DELIVERY_NOT_FOUND');
  if (!['PLACED', 'PENDING_DISPATCH'].includes(existing.status)) {
    throw new Error('DELIVERY_NOT_EDITABLE');
  }

  const delivery = await prisma.$transaction(async (tx: TxClient) => {
    const data: Record<string, unknown> = {};
    if (input.codAmount !== undefined) data.codAmount = new Decimal(input.codAmount.toString()).toFixed(2);
    if (input.declaredValue !== undefined) data.declaredValue = input.declaredValue;
    if (input.itemCount !== undefined) data.itemCount = input.itemCount;
    if (input.totalWeightKg !== undefined) data.totalWeightKg = new Decimal(input.totalWeightKg.toString()).toFixed(2);
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.assignedStaffId !== undefined) data.assignedStaffId = input.assignedStaffId;

    // Recompute fee when weight or destination changes, using the stored value
    // for whichever input was not supplied (an address-only or weight-only edit
    // must keep the other dimension and its zone override).
    if (input.totalWeightKg !== undefined || input.address) {
      const fee = await calculateShippingFee({
        tenantId,
        weightKg: input.totalWeightKg !== undefined
          ? (data.totalWeightKg as string | undefined)
          : existing.totalWeightKg?.toString(),
        destinationCityId: input.address ? input.address.cityId : existing.address?.cityId,
        destinationDistrictId: input.address
          ? input.address.districtId
          : existing.address?.districtId,
      });
      data.shippingFee = fee.shippingFee.toFixed(2);
    }

    const updated = await tx.delivery.update({ where: { id }, data: data as never });

    if (input.address && existing.addressId) {
      await tx.shippingAddress.update({
        where: { id: existing.addressId },
        data: {
          fullName: input.address.fullName,
          phone: input.address.phone,
          phone2: input.address.phone2 ?? null,
          addressLine1: input.address.addressLine1,
          addressLine2: input.address.addressLine2 ?? null,
          districtId: input.address.districtId ?? null,
          districtName: input.address.districtName ?? null,
          cityId: input.address.cityId ?? null,
          cityName: input.address.cityName,
          postalCode: input.address.postalCode ?? null,
        },
      });
    }

    void createAuditLog({
      tenantId,
      actorId: userId,
      actorRole: 'UNKNOWN',
      entityType: 'Delivery',
      entityId: id,
      action: AUDIT_ACTIONS.DELIVERY_UPDATED,
      after: data as Prisma.InputJsonValue,
    });

    return updated;
  });

  return getDeliveryById(tenantId, delivery.id);
}

export async function cancelDelivery(
  tenantId: string,
  id: string,
  userId: string,
  input: CancelDeliveryInput,
): Promise<unknown> {
  setSentryTenantContext({ tenantId });

  const existing = await prisma.delivery.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { shipments: { where: { status: { notIn: TERMINAL_SHIPMENT_STATUSES } } } },
  });
  if (!existing) throw new Error('DELIVERY_NOT_FOUND');

  // Idempotent + terminal-safe: a repeated cancel must not restock twice, and
  // a delivered/returned delivery can never be cancelled/restocked.
  if (existing.status === 'CANCELED') {
    return getDeliveryById(tenantId, id);
  }
  if (
    existing.status === 'DELIVERED' ||
    existing.status === 'RETURNED' ||
    existing.status === 'DISPATCHED' ||
    existing.status === 'IN_TRANSIT' ||
    existing.status === 'OUT_FOR_DELIVERY' ||
    existing.status === 'PENDING_PICKUP'
  ) {
    throw new Error('DELIVERY_NOT_CANCELABLE');
  }

  // Standard cancel is only for pre-dispatch deliveries. Failed/returned
  // parcels go through the recovery "permanent cancel" path instead.
  if (existing.shipments.length > 0) {
    throw new Error('DELIVERY_ALREADY_DISPATCHED');
  }

  const delivery = await prisma.$transaction(async (tx: TxClient) => {
    // Claim the state transition atomically; a concurrent second cancel sees
    // zero rows and must not restock the same lines again.
    const claimed = await tx.delivery.updateMany({
      where: { id, tenantId, status: { in: ['PLACED', 'PENDING_DISPATCH', 'HOLD'] } },
      data: { status: 'CANCELED', canceledAt: new Date(), canceledById: userId },
    });
    if (claimed.count === 0) throw new Error('DELIVERY_NOT_CANCELABLE');

    // M28-01: website orders reserved stock at placement — canceling returns it
    // to the ledger (reversal movement, mirroring the WEBSITE_ORDER reason).
    const lines = await tx.deliveryLine.findMany({
      where: { deliveryId: id, tenantId },
      select: { variantId: true, quantity: true },
    });
    for (const line of lines) {
      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, tenantId },
        select: { stockQuantity: true },
      });
      if (!variant) continue;
      await tx.productVariant.update({
        where: { id: line.variantId },
        data: { stockQuantity: { increment: line.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          variantId: line.variantId,
          quantityDelta: line.quantity,
          quantityBefore: variant.stockQuantity,
          quantityAfter: variant.stockQuantity + line.quantity,
          reason: 'WEBSITE_ORDER' as StockMovementReason,
          note: 'Website order canceled — stock returned',
          actorId: userId,
        },
      });
    }

    await tx.deliveryEvent.create({
      data: {
        tenantId,
        deliveryId: id,
        status: 'CANCELED',
        source: 'USER',
        createdById: userId,
        remarks: input.reason ?? 'Canceled',
      },
    });

    // A cancelled delivery must not remain a COD receivable.
    await tx.reconciliationLedgerEntry.updateMany({
      where: {
        tenantId,
        deliveryId: id,
        status: { in: ['PENDING_SETTLEMENT', 'MATCHED', 'PARTIAL_MATCH', 'DISCREPANCY'] },
      },
      data: {
        status: 'CLEARED',
        expectedCod: 0,
        expectedNetPayout: 0,
        settledAmount: 0,
        settledAt: new Date(),
        discrepancyNote: 'Delivery cancelled',
      },
    });
    void createAuditLog({
      tenantId,
      actorId: userId,
      actorRole: 'UNKNOWN',
      entityType: 'Delivery',
      entityId: id,
      action: AUDIT_ACTIONS.DELIVERY_CANCELED,
      after: { reason: input.reason ?? null },
    });
    return { id };
  });

  return getDeliveryById(tenantId, delivery.id);
}

/**
 * Dispatch a delivery to Trans Express.
 * Idempotent: only dispatches a PENDING_DISPATCH delivery with no active shipment.
 */
export async function dispatchDelivery(
  tenantId: string,
  id: string,
  userId: string,
  input: DispatchDeliveryInput,
): Promise<unknown> {
  setSentryTenantContext({ tenantId });

  const existing = await prisma.delivery.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      address: true,
      shipments: true,
    },
  });
  if (!existing) throw new Error('DELIVERY_NOT_FOUND');
  if (existing.status !== 'PENDING_DISPATCH') throw new Error('DELIVERY_NOT_DISPATCHABLE');
  if (existing.shipments.length > 0) throw new Error('DELIVERY_ALREADY_DISPATCHED');
  if (!existing.address) throw new Error('DELIVERY_MISSING_ADDRESS');
  // Block dispatch of unpaid card orders. COD is unpaid-by-design and is the
  // default; CARD orders must be confirmed PAID by the gateway before the
  // courier handoff.
  if (
    existing.paymentMethod !== 'COD' &&
    existing.paymentStatus !== 'PAID'
  ) {
    throw new Error('DELIVERY_PAYMENT_NOT_SETTLED');
  }

  const account = await prisma.courierAccount.findFirst({ where: { tenantId } });
  if (!account?.isActive) throw new Error('COURIER_ACCOUNT_NOT_CONFIGURED');

  // Resolve the provider adapter by the account's configured provider so the
  // dispatch pipeline stays carrier-agnostic.
  const adapter = resolveAdapterForAccount(account);

  // Authenticate (API key for prod, or login for staging).
  const auth = await adapter.authenticate({
    email: account.email ?? undefined,
    password: account.password ?? undefined,
    apiKey: account.apiKey ?? undefined,
    env: account.env,
  });
  if (!auth.ok) throw new Error(`COURIER_AUTH_FAILED:${auth.error.message}`);

  // Build the provider-agnostic payload via the shared mapper.
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
    { orderRef: existing.orderRef, codAmount: existing.codAmount, notes: existing.notes, itemCount: existing.itemCount },
    { waybillId: input.waybillMode === 'MANUAL' ? input.manualWaybillId : undefined },
  );

  const upload = await adapter.uploadSingle(account.env, auth.data, {
    waybillMode: input.waybillMode,
    payload,
  });
  if (!upload.ok) throw new Error(`COURIER_UPLOAD_FAILED:${upload.error.message}`);

  const { dispatched, deductions } = await prisma.$transaction(async (tx: TxClient) => {
    const updated = await tx.delivery.update({
      where: { id },
      data: {
        status: 'DISPATCHED',
        courierOrderRef: existing.orderRef,
        dispatchedAt: new Date(),
        holdExpiresAt: null,
      },
    });

    await createShipment({
      tenantId,
      deliveryId: id,
      env: account.env,
      waybillId: upload.data.waybillId,
      waybillMode: input.waybillMode,
      courierOrderId: upload.data.courierOrderId,
      lastRawResponse: upload.data.raw,
      tx,
    });

    await tx.deliveryEvent.create({
      data: {
        tenantId,
        deliveryId: id,
        status: 'DISPATCHED',
        source: 'INTERNAL',
        createdById: userId,
        remarks: `Dispatched via ${account.provider} (${input.waybillMode})`,
      },
    });

    void createAuditLog({
      tenantId,
      actorId: userId,
      actorRole: 'UNKNOWN',
      entityType: 'Delivery',
      entityId: id,
      action: AUDIT_ACTIONS.DELIVERY_DISPATCHED,
      after: { waybillId: upload.data.waybillId, waybillMode: input.waybillMode },
    });

    // M23: packaging auto-deduction runs inside the same transaction as the
    // status flip, so a parcel can never be marked DISPATCHED with its
    // packaging stock left un-deducted. The low-stock notification stays
    // outside the transaction (notifications must not roll stock back).
    const deductions = await autoDeductPackaging(tenantId, id, { tx });

    return { dispatched: updated, deductions };
  });

  // Non-blocking low-stock notification for anything that fell short.
  if (deductions.length > 0) {
    await notifyLowStock(tenantId, id, deductions);
  }

  void createDispatchNotification(tenantId, dispatched.id, existing.orderRef);

  return getDeliveryById(tenantId, dispatched.id);
}

/** Live-track a shipment via the adapter (user-initiated). */
export async function trackShipment(tenantId: string, shipmentId: string, userId: string) {
  setSentryTenantContext({ tenantId });

  const shipment = await prisma.courierShipment.findFirst({
    where: { id: shipmentId, tenantId },
    include: { delivery: { select: { id: true, tenantId: true } } },
  });
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND');

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

  const result = await adapter.track(account.env, auth.data, shipment.waybillId);
  if (!result.ok) throw new Error(`COURIER_TRACKING_FAILED:${result.error.message}`);

  const { applyTrackingUpdate } = await import('@/lib/services/tracking.service');
  await applyTrackingUpdate(shipment.id, shipment.deliveryId, tenantId, result.data, adapter);

  void createAuditLog({
    tenantId,
    actorId: userId,
    actorRole: 'UNKNOWN',
    entityType: 'CourierShipment',
    entityId: shipmentId,
    action: AUDIT_ACTIONS.DELIVERY_STATUS_CHANGED,
  });

  return result.data;
}

async function createDispatchNotification(tenantId: string, deliveryId: string, orderRef: string): Promise<void> {
  try {
    const recipients = await prisma.user.findMany({
      where: { tenantId, role: { in: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'] }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (recipients.length === 0) return;
    await prisma.notificationRecord.createMany({
      data: recipients.map((r) => ({
        tenantId,
        recipientId: r.id,
        type: 'DELIVERY_DISPATCHED' as const,
        title: 'Delivery dispatched',
        body: `Order ${orderRef} dispatched via Trans Express`,
        relatedEntityType: 'Delivery',
        relatedEntityId: deliveryId,
      })),
    });
  } catch (error) {
    console.warn('Dispatch notification failed:', error);
  }
}

/**
 * Scan for deliveries whose hold-buffer window has expired but are still
 * PENDING_DISPATCH, and notify dispatch staff. Called by the
 * /api/cron/clear-held-deliveries cron. Does not auto-dispatch (the API cannot
 * edit/cancel after submission, so staff review is required).
 */
export async function processExpiringHolds(): Promise<{ notified: number }> {
  const now = new Date();
  const expiring = await prisma.delivery.findMany({
    where: { status: 'PENDING_DISPATCH', holdExpiresAt: { lt: now }, deletedAt: null },
    select: { id: true, tenantId: true, orderRef: true },
    take: 100,
  });

  if (expiring.length === 0) return { notified: 0 };

  let notified = 0;
  for (const delivery of expiring) {
    try {
      const alreadyNotified = await prisma.notificationRecord.findFirst({
        where: {
          tenantId: delivery.tenantId,
          type: 'DELIVERY_HELD_EXPIRING',
          relatedEntityType: 'Delivery',
          relatedEntityId: delivery.id,
        },
        select: { id: true },
      });
      if (alreadyNotified) continue;

      const recipients = await prisma.user.findMany({
        where: { tenantId: delivery.tenantId, role: { in: ['OWNER', 'MANAGER', 'DISPATCH_STAFF'] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (recipients.length === 0) continue;
      await prisma.notificationRecord.createMany({
        data: recipients.map((r) => ({
          tenantId: delivery.tenantId,
          recipientId: r.id,
          type: 'DELIVERY_HELD_EXPIRING' as const,
          title: 'Delivery hold expiring',
          body: `Order ${delivery.orderRef} hold window has expired and still awaits dispatch`,
          relatedEntityType: 'Delivery',
          relatedEntityId: delivery.id,
        })),
      });
      notified++;
    } catch (error) {
      console.warn(`Hold-expiry notification failed for ${delivery.id}:`, error);
    }
  }

  return { notified };
}
