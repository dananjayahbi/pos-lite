/**
 * Raw Material Alert Service — detects raw materials at or below their
 * low-stock threshold and surfaces them as factory/procurement notifications
 * (doc 27). Reuses the existing `NotificationRecord` infrastructure and the
 * `RAW_MATERIAL_LOW_STOCK` / `RAW_MATERIAL_CRITICAL` notification types.
 */
import { prisma } from '@/lib/prisma';
import type {
  RawMaterial,
  RawMaterialCategory,
  Unit,
  UserRole,
} from '@/generated/prisma/client';
import { getRawMaterialStockStatus } from '@/lib/services/rawMaterial.core';

export type RawMaterialAlertSeverity = 'LOW' | 'CRITICAL';

export interface RawMaterialAlert {
  rawMaterialId: string;
  name: string;
  category: RawMaterialCategory;
  unit: Unit;
  quantity: number;
  lowStockThreshold: number;
  /** LOW = at/below threshold but above zero; CRITICAL = out of stock. */
  severity: RawMaterialAlertSeverity;
}

/**
 * Compute the alert for a raw material row, or `null` when it is not flagged.
 * A material is flagged when quantity is at or below the low-stock threshold.
 */
export function evaluateRawMaterialAlert(
  material: Pick<RawMaterial, 'quantity' | 'lowStockThreshold'>,
): RawMaterialAlertSeverity | null {
  const quantity = material.quantity.toNumber();
  const threshold = material.lowStockThreshold.toNumber();

  // No threshold configured ⇒ never alert.
  if (threshold <= 0) return null;

  const status = getRawMaterialStockStatus(quantity, threshold);
  if (status === 'OUT') return 'CRITICAL';
  if (status === 'LOW') return 'LOW';
  return null;
}

/** Non-blocking notification of an alert to factory-relevant roles. */
export async function notifyRawMaterialAlert(
  tenantId: string,
  alert: Omit<RawMaterialAlert, 'rawMaterialId'> & { rawMaterialId: string },
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

    const isCritical = alert.severity === 'CRITICAL';
    const type: 'RAW_MATERIAL_CRITICAL' | 'RAW_MATERIAL_LOW_STOCK' = isCritical
      ? 'RAW_MATERIAL_CRITICAL'
      : 'RAW_MATERIAL_LOW_STOCK';
    await prisma.notificationRecord.createMany({
      data: recipients.map((r) => ({
        tenantId,
        recipientId: r.id,
        type,
        title: isCritical
          ? 'Critical: raw material out of stock'
          : 'Raw material low stock',
        body: `${alert.name} is at ${alert.quantity} ${alert.unit === 'LITERS' ? 'L' : 'kg'} (threshold ${alert.lowStockThreshold})`,
        relatedEntityType: 'RawMaterial',
        relatedEntityId: alert.rawMaterialId,
      })),
    });
  } catch (error) {
    console.warn('Raw-material alert notification failed:', error);
  }
}

/** Current alert state for a tenant — material rows currently flagged. */
export async function listRawMaterialAlerts(tenantId: string): Promise<RawMaterialAlert[]> {
  const rows = await prisma.rawMaterial.findMany({
    where: { tenantId, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      quantity: true,
      lowStockThreshold: true,
    },
  });

  const alerts: RawMaterialAlert[] = [];
  for (const row of rows) {
    const severity = evaluateRawMaterialAlert(row);
    if (!severity) continue;
    alerts.push({
      rawMaterialId: row.id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      quantity: row.quantity.toNumber(),
      lowStockThreshold: row.lowStockThreshold.toNumber(),
      severity,
    });
  }

  // Critical first, then by quantity ascending.
  return alerts.sort(
    (a, b) =>
      (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1) ||
      a.quantity - b.quantity,
  );
}

/**
 * Scheduled check — scan all active tenants' raw materials, flag those at/below
 * threshold, and emit notifications to factory/procurement roles. Returns a
 * summary of alerts detected. Safe to run on a cron schedule.
 */
export async function scanRawMaterialAlerts() {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });

  let lowCount = 0;
  let criticalCount = 0;

  for (const tenant of tenants) {
    const alerts = await listRawMaterialAlerts(tenant.id);
    for (const alert of alerts) {
      if (alert.severity === 'CRITICAL') criticalCount += 1;
      else lowCount += 1;
      await notifyRawMaterialAlert(tenant.id, alert);
    }
  }

  return { tenantsScanned: tenants.length, lowCount, criticalCount };
}
