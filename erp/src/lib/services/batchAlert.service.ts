/**
 * Batch Expiry Alert Service — detects expired and near-expiry batches and
 * surfaces them as notifications (doc 30, reusing the doc 27 alert pattern).
 * Reuses `NotificationRecord` + the `BATCH_EXPIRED` / `BATCH_EXPIRY_SOON` types.
 */
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/generated/prisma/client';
import {
  getBatchExpiryStatus,
  EXPIRE_SOON_WINDOW_DAYS,
  type BatchExpiryStatus,
} from '@/lib/services/batchTracking.core';

export type BatchAlertSeverity = 'EXPIRED' | 'EXPIRING_SOON';

export interface BatchAlert {
  batchId: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  sku: string;
  productName: string;
  severity: BatchAlertSeverity;
}

/** Evaluate a single batch row → alert severity, or null when not flagged. */
export function evaluateBatchAlert(
  expiryDate: Date | null | undefined,
): BatchAlertSeverity | null {
  const status = getBatchExpiryStatus(expiryDate);
  if (status === 'EXPIRED') return 'EXPIRED';
  if (status === 'EXPIRING_SOON') return 'EXPIRING_SOON';
  return null;
}

/** Non-blocking notification of batch alerts to inventory-relevant roles. */
export async function notifyBatchAlert(
  tenantId: string,
  alert: BatchAlert,
): Promise<void> {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['OWNER', 'MANAGER', 'FACTORY_MANAGER'] as UserRole[] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (recipients.length === 0) return;

    const isExpired = alert.severity === 'EXPIRED';
    const type: 'BATCH_EXPIRED' | 'BATCH_EXPIRY_SOON' = isExpired
      ? 'BATCH_EXPIRED'
      : 'BATCH_EXPIRY_SOON';
    await prisma.notificationRecord.createMany({
      data: recipients.map((r) => ({
        tenantId,
        recipientId: r.id,
        type,
        title: isExpired
          ? 'Batch expired'
          : `Batch expiring within ${EXPIRE_SOON_WINDOW_DAYS} days`,
        body: `${alert.productName} (${alert.sku}) batch ${alert.batchNumber} has ${alert.quantity} units ${
          isExpired ? 'expired' : 'expiring soon'
        }${alert.expiryDate ? ` (expiry ${alert.expiryDate.slice(0, 10)})` : ''}`,
        relatedEntityType: 'BatchTracking',
        relatedEntityId: alert.batchId,
      })),
    });
  } catch (error) {
    console.warn('Batch alert notification failed:', error);
  }
}

/** Currently flagged batches for a tenant. */
export async function listBatchAlerts(tenantId: string): Promise<BatchAlert[]> {
  const rows = await prisma.batchTracking.findMany({
    where: { tenantId },
    select: {
      id: true,
      batchNumber: true,
      expiryDate: true,
      quantity: true,
      variant: {
        select: { sku: true, product: { select: { name: true } } },
      },
    },
  });

  const alerts: BatchAlert[] = [];
  for (const row of rows) {
    const severity = evaluateBatchAlert(row.expiryDate);
    if (!severity) continue;
    alerts.push({
      batchId: row.id,
      batchNumber: row.batchNumber,
      expiryDate: row.expiryDate ? row.expiryDate.toISOString() : null,
      quantity: row.quantity,
      sku: row.variant.sku,
      productName: row.variant.product.name,
      severity,
    });
  }

  // Expired first, then by soonest expiry.
  return alerts.sort(
    (a, b) =>
      (a.severity === 'EXPIRED' ? 0 : 1) - (b.severity === 'EXPIRED' ? 0 : 1) ||
      (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''),
  );
}

/** Cron entrypoint — loop active tenants and emit expiry notifications. */
export async function scanBatchAlerts() {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });

  let expiredCount = 0;
  let expiringSoonCount = 0;
  for (const tenant of tenants) {
    const alerts = await listBatchAlerts(tenant.id);
    for (const alert of alerts) {
      if (alert.severity === 'EXPIRED') expiredCount += 1;
      else expiringSoonCount += 1;
      await notifyBatchAlert(tenant.id, alert);
    }
  }

  return { tenantsScanned: tenants.length, expiredCount, expiringSoonCount };
}
