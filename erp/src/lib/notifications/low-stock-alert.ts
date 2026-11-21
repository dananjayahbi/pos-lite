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

  await client.notificationRecord.createMany({
    data: low.flatMap((candidate) =>
      recipients.map((recipient) => ({
        tenantId,
        recipientId: recipient.id,
        type: 'LOW_STOCK_ALERT' as const,
        title: lowStockAlertTitle(candidate),
        body: lowStockAlertBody(candidate, context),
        relatedEntityType: 'ProductVariant',
        relatedEntityId: candidate.variantId,
      })),
    ),
  });

  return low.length * recipients.length;
}
