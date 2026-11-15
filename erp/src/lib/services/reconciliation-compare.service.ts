import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  parseRemittanceFile,
  type RemittanceParsedRow,
} from '@/lib/services/reconciliation-parser.service';
import {
  buildDeliveryComparison,
  parseMoney,
  type DeliveryComparisonReport,
  type StatementRowForComparison,
  type SystemDeliveryForComparison,
} from '@/lib/services/reconciliation-compare.core';

export * from '@/lib/services/reconciliation-compare.core';

/**
 * Dry-run comparison of our delivered orders against a courier statement.
 *
 * Nothing is written to the ledger here; uploading/importing a statement is a
 * separate, explicit action once the operator has reviewed the differences.
 */
export async function getDeliveryComparisonReport(
  tenantId: string,
  filename: string,
  buffer: Buffer,
  from: string,
  to: string,
): Promise<DeliveryComparisonReport> {
  const parsed = parseRemittanceFile(filename, buffer);
  const statementRows = toStatementRows(parsed);

  const rangeStart = new Date(`${from}T00:00:00.000Z`);
  const rangeEnd = new Date(`${to}T23:59:59.999Z`);

  const deliveries = await prisma.delivery.findMany({
    where: {
      tenantId,
      status: 'DELIVERED',
      deliveredAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: {
      id: true,
      orderRef: true,
      codAmount: true,
      shippingFee: true,
      deliveredAt: true,
      status: true,
      shipments: {
        select: { waybillId: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      reconciliationEntry: {
        select: { waybillId: true, status: true },
      },
    },
    orderBy: { deliveredAt: 'asc' },
  });

  const systemRows: SystemDeliveryForComparison[] = deliveries.map((delivery) => ({
    deliveryId: delivery.id,
    waybillId:
      delivery.reconciliationEntry?.waybillId ?? delivery.shipments[0]?.waybillId ?? null,
    orderRef: delivery.orderRef,
    expectedCod: Number(delivery.codAmount.toString()),
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    deliveryStatus: delivery.status,
    shippingFee: delivery.shippingFee ? Number(delivery.shippingFee.toString()) : null,
    settlementStatus: delivery.reconciliationEntry?.status ?? 'PENDING_SETTLEMENT',
  }));

  return buildDeliveryComparison({
    deliveries: systemRows,
    statementRows,
    from,
    to,
    filename,
  });
}

export function toStatementRows(rows: RemittanceParsedRow[]): StatementRowForComparison[] {
  return rows.map((row) => ({
    waybill: row.waybill ?? null,
    orderRef: row.orderRef ?? null,
    amount: parseMoney(row.amount),
    fees: parseMoney(row.fees),
    status: row.status ?? null,
    date: row.date ?? null,
    raw: row.raw,
  }));
}
