import { prisma } from '@/lib/prisma';

/**
 * Human-readable purchase-order references.
 *
 * Format: `PO-YYYYMM-####`, sequential per tenant and per month. The reference
 * is UNIQUE per tenant, so two operators creating POs at the same moment would
 * otherwise race the same number and one would hit P2002. `createPO` retries on
 * a conflict, which makes a collision harmless rather than a failed save.
 *
 * Users may override the generated number with their own (e.g. a supplier's
 * own PO number); this module only supplies the default and the validation.
 */

export const PO_REFERENCE_PREFIX = 'PO';

export function formatPurchaseOrderReference(year: number, month: number, sequence: number): string {
  return `${PO_REFERENCE_PREFIX}-${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Next free reference for the month of `at` (defaults to now).
 *
 * Counts existing references matching the month prefix rather than reading the
 * last one, so deleting a PO doesn't cause a duplicate.
 */
export async function generatePurchaseOrderReference(
  tenantId: string,
  at: Date = new Date(),
): Promise<string> {
  const year = at.getFullYear();
  const month = at.getMonth() + 1;
  const prefix = `${PO_REFERENCE_PREFIX}-${year}${String(month).padStart(2, '0')}-`;

  const existing = await prisma.purchaseOrder.findMany({
    where: { tenantId, referenceNo: { startsWith: prefix } },
    select: { referenceNo: true },
  });

  const used = new Set(
    existing
      .map((row) => Number.parseInt(row.referenceNo.slice(prefix.length), 10))
      .filter((value) => Number.isFinite(value)),
  );

  let sequence = 1;
  while (used.has(sequence)) sequence += 1;

  return formatPurchaseOrderReference(year, month, sequence);
}

/** True when an operator typed their own reference and it's already taken. */
export async function isPurchaseOrderReferenceTaken(
  tenantId: string,
  referenceNo: string,
  excludeId?: string,
): Promise<boolean> {
  const clash = await prisma.purchaseOrder.findFirst({
    where: {
      tenantId,
      referenceNo,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  return clash !== null;
}
