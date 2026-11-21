import type { TxClient } from '@/lib/services/inventory.service';
import { isLowStockVariant } from '@/lib/inventory/lowStockPredicate';

/**
 * One producer for product low-stock notifications (ARGUS #55).
 *
 * Manual stock adjustments and stock-take approval already wrote
 * `LOW_STOCK_ALERT` rows inline; sales did not, so the dashboard could show low
 * variants while the inbox stayed empty. This module owns the shared rule
 * (`isLowStockVariant`) and the row shape so every stock-moving path emits the
 * same alert instead of copying the threshold comparison.
 */

export interface LowStockAlertCandidate {
  variantId: string;
  productName: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  /**
   * Quantity before the movement. When supplied, an alert is emitted only when
   * this movement crosses into low stock; a variant that was already low does
   * not generate another alert on every sale.
   */
  previousQuantity?: number;
}

/**
 * Filter/de-duplicate candidates using the one low-stock rule. Pure, so the
 * "which sale lines alert" decision is testable without a database.
 */
export function selectLowStockAlerts(
  candidates: readonly LowStockAlertCandidate[],
): LowStockAlertCandidate[] {
  const seen = new Set<string>();
  const selected: LowStockAlertCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.variantId)) continue;
    if (
      !isLowStockVariant({
        stockQuantity: candidate.stockQuantity,
        lowStockThreshold: candidate.lowStockThreshold,
      })
    ) {
      continue;
    }
    if (
      candidate.previousQuantity !== undefined &&
      candidate.previousQuantity <= candidate.lowStockThreshold
    ) {
      continue;
    }
    seen.add(candidate.variantId);
    selected.push(candidate);
  }

  return selected;
}

export function lowStockAlertTitle(candidate: LowStockAlertCandidate): string {
  return `${candidate.productName} - ${candidate.sku} is low on stock`;
}

export function lowStockAlertBody(
  candidate: LowStockAlertCandidate,
  context: string,
): string {
  return `Current stock: ${candidate.stockQuantity} units. Threshold: ${candidate.lowStockThreshold} units. ${context}.`;
}

/** Minimal recipient row used by the writer and its tests. */
export interface LowStockRecipient {
  id: string;
}

/** An unread LOW_STOCK_ALERT already in the inbox. */
export interface ExistingLowStockAlert {
  recipientId: string;
  relatedEntityId: string | null;
}

export interface LowStockAlertPair {
  candidate: LowStockAlertCandidate;
  recipientId: string;
}

/**
 * ARGUS #197 - one unread alert per variant/recipient.
 *
 * Repeated corrections around the threshold used to write a fresh
 * LOW_STOCK_ALERT for every owner/manager on every adjustment. An unread alert
 * for the same variant already tells that recipient everything the new row
 * would, so it is skipped until the existing one is read.
 */
export function filterNewLowStockAlerts(
  candidates: readonly LowStockAlertCandidate[],
  recipients: readonly LowStockRecipient[],
  existing: readonly ExistingLowStockAlert[] = [],
): LowStockAlertPair[] {
  const seen = new Set(
    existing.map((row) => `${row.recipientId}::${row.relatedEntityId ?? ''}`),
  );
  const pairs: LowStockAlertPair[] = [];

  for (const candidate of candidates) {
    for (const recipient of recipients) {
      const key = `${recipient.id}::${candidate.variantId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ candidate, recipientId: recipient.id });
    }
  }

  return pairs;
}

/**
 * Write one alert per low variant to every active owner/manager. Best-effort:
 * callers may await it (manual adjustment transaction) or fire-and-forget after
 * a committed sale. Returns the number of rows written.
 */
export async function createLowStockAlerts(
  client: Pick<TxClient, 'user' | 'notificationRecord'>,
  tenantId: string,
  candidates: readonly LowStockAlertCandidate[],
  context: string,
): Promise<number> {
  const low = selectLowStockAlerts(candidates);
  if (low.length === 0) return 0;

  const recipients = await client.user.findMany({
    where: {
      tenantId,
      role: { in: ['OWNER', 'MANAGER'] },
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (recipients.length === 0) return 0;

  // ARGUS #197: do not duplicate an unread alert for the same variant. The
  // lookup is tenant-scoped and limited to the candidates being written.
  const existing = await client.notificationRecord.findMany({
    where: {
      tenantId,
      type: 'LOW_STOCK_ALERT' as const,
      isRead: false,
      relatedEntityType: 'ProductVariant',
      relatedEntityId: { in: low.map((candidate) => candidate.variantId) },
    },
    select: { recipientId: true, relatedEntityId: true },
  });

  const pairs = filterNewLowStockAlerts(low, recipients, existing);
  if (pairs.length === 0) return 0;

  await client.notificationRecord.createMany({
    data: pairs.map(({ candidate, recipientId }) => ({
      tenantId,
      recipientId,
      type: 'LOW_STOCK_ALERT' as const,
      title: lowStockAlertTitle(candidate),
      body: lowStockAlertBody(candidate, context),
      relatedEntityType: 'ProductVariant',
      relatedEntityId: candidate.variantId,
    })),
  });

  return pairs.length;
}
