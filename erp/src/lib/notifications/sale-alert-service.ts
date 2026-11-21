import { prisma } from '@/lib/prisma';
import { buildSaleVoidedCopy } from './sale-alert-copy';

/**
 * ARGUS #52 — rewrite the sale-completed alerts for a sale that was just
 * voided, so recipients no longer see "Sale Completed" with a stale amount.
 *
 * Existing rows keep their `SALE_COMPLETED` type (no new enum value/migration);
 * their title/body become the void copy and they are marked unread again so
 * the status change is noticed. If the sale predates the alerts (or they were
 * cleared), owner/manager recipients get a fresh void alert instead.
 *
 * Intentionally non-transactional: it runs after the void transaction commits
 * and is best-effort, matching the other notification producers.
 */
export async function notifySaleVoided(
  tenantId: string,
  sale: { id: string; totalAmount: number | string },
): Promise<number> {
  const { title, body } = buildSaleVoidedCopy(sale.id, sale.totalAmount);

  const updated = await prisma.notificationRecord.updateMany({
    where: {
      tenantId,
      type: 'SALE_COMPLETED',
      relatedEntityType: 'Sale',
      relatedEntityId: sale.id,
    },
    data: { title, body, isRead: false },
  });

  if (updated.count > 0) return updated.count;

  const recipients = await prisma.user.findMany({
    where: { tenantId, role: { in: ['OWNER', 'MANAGER'] }, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (recipients.length === 0) return 0;

  await prisma.notificationRecord.createMany({
    data: recipients.map((recipient) => ({
      tenantId,
      recipientId: recipient.id,
      type: 'SALE_COMPLETED' as const,
      title,
      body,
      relatedEntityType: 'Sale',
      relatedEntityId: sale.id,
    })),
  });

  return recipients.length;
}
