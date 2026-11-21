import 'server-only';

import type { PrismaClient } from '@/generated/prisma/client';
import { collectableCodAmount } from '@/lib/delivery/cod';

type CodLedgerTx = Pick<PrismaClient, 'reconciliationLedgerEntry'>;

interface DeliveredCodDelivery {
  id: string;
  tenantId: string;
  status: string;
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
  codAmount: { toString(): string } | number | null | undefined;
  shippingFee?: { toString(): string } | number | null | undefined;
}

/**
 * ARGUS #511 — ensure a delivered unpaid COD delivery has exactly one
 * reconciliation receivable. Called by every path that flips a delivery to
 * DELIVERED (courier tracking and the manual/bulk status route), so the live
 * ledger cannot drift from the delivered-COD total.
 */
export async function ensureDeliveredCodEntry(
  tx: CodLedgerTx,
  delivery: DeliveredCodDelivery,
  waybillId?: string | null,
) {
  if (delivery.status !== 'DELIVERED' || delivery.paymentMethod !== 'COD') return null;
  if (delivery.paymentStatus === 'PAID') return null;

  const expectedCod = collectableCodAmount({
    codAmount: delivery.codAmount,
    shippingFee: delivery.shippingFee,
    paymentMethod: delivery.paymentMethod,
    paymentStatus: delivery.paymentStatus,
  });
  if (expectedCod.lessThanOrEqualTo(0)) return null;

  return tx.reconciliationLedgerEntry.upsert({
    where: { deliveryId: delivery.id },
    create: {
      tenantId: delivery.tenantId,
      deliveryId: delivery.id,
      waybillId: waybillId ?? null,
      expectedCod,
      status: 'PENDING_SETTLEMENT',
    },
    update: {},
  });
}
