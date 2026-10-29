import Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import { PaymentEntrySource, POStatus } from '@/generated/prisma/client';
import type { PayPurchaseOrderInput } from '@/lib/validators/purchaseOrder.validators';
import {
  assertSufficientFunds,
  postLedgerEntries,
} from '@/lib/services/paymentAccount.service';

/**
 * Settling a purchase order from a payment account.
 *
 * A PO can be paid in instalments and from different accounts, so this creates
 * a `PurchaseOrderPayment` row per payment and posts a matching ledger entry.
 * `PurchaseOrder.paidAt` is stamped once the accumulated payments cover the
 * payable total, which is what the list uses to show "Paid".
 */

function money(value: Decimal): number {
  return value.toDecimalPlaces(2).toNumber();
}

/** How much has already been paid against this PO. */
export async function getPurchaseOrderPaidAmount(
  tenantId: string,
  purchaseOrderId: string,
): Promise<number> {
  const aggregate = await prisma.purchaseOrderPayment.aggregate({
    where: { tenantId, purchaseOrderId },
    _sum: { amount: true },
  });

  return money(new Decimal(aggregate._sum.amount ?? 0));
}

export async function payPurchaseOrder(
  tenantId: string,
  actorId: string,
  actorRole: string,
  purchaseOrderId: string,
  input: PayPurchaseOrderInput,
) {
  return prisma.$transaction(
    async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      select: {
        id: true,
        referenceNo: true,
        totalAmount: true,
        status: true,
        supplier: { select: { name: true } },
      },
    });

    if (!po) {
      throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found');
    }

    // A cancelled PO owes nothing; paying it would create unbacked money.
    if (po.status === POStatus.CANCELLED) {
      throw new ApiError(409, 'CONFLICT', 'A cancelled purchase order cannot be paid');
    }

    const account = await tx.paymentAccount.findFirst({
      where: { id: input.paymentAccountId, tenantId },
      select: { id: true, name: true, status: true },
    });

    if (!account) {
      throw new ApiError(404, 'NOT_FOUND', 'Payment account not found');
    }
    if (account.status !== 'ACTIVE') {
      throw new ApiError(409, 'CONFLICT', `Account "${account.name}" is closed`);
    }

    const alreadyPaid = await getPurchaseOrderPaidAmount(tenantId, po.id);
    const payable = money(new Decimal(po.totalAmount));
    const outstanding = money(new Decimal(payable).minus(alreadyPaid));
    const requested = money(new Decimal(input.amount));

    if (requested > outstanding) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        `This purchase order only has ${outstanding.toFixed(2)} outstanding`,
      );
    }

    await assertSufficientFunds(tx, tenantId, account.id, requested);

    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

    const payment = await tx.purchaseOrderPayment.create({
      data: {
        tenantId,
        purchaseOrderId: po.id,
        paymentAccountId: account.id,
        amount: requested,
        paidAt,
        ...(input.reference !== undefined ? { reference: input.reference } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        recordedById: actorId,
      },
    });

    await postLedgerEntries(tx, tenantId, actorId, [
      {
        accountId: account.id,
        source: PaymentEntrySource.PURCHASE_ORDER_PAYMENT,
        sourceId: payment.id,
        description: `PO ${po.referenceNo} — ${po.supplier.name}`,
        credit: requested,
        entryDate: paidAt,
      },
    ]);

    // Stamp the PO as fully settled once nothing is outstanding.
    const newPaid = money(new Decimal(alreadyPaid).plus(requested));
    if (newPaid >= payable) {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { paidAt },
      });
    }

    await createAuditLog({
      tenantId,
      actorId,
      actorRole,
      entityType: 'PurchaseOrderPayment',
      entityId: payment.id,
      action: AUDIT_ACTIONS.PURCHASE_ORDER_PAID,
      after: {
        purchaseOrder: po.referenceNo,
        account: account.name,
        amount: requested,
        paidTotal: newPaid,
        payable,
      },
    });

    return {
      paymentId: payment.id,
      amount: requested,
      paidTotal: newPaid,
      payable,
      outstanding: money(new Decimal(payable).minus(newPaid)),
      settled: newPaid >= payable,
    };
    },
    // A settlement touches the PO, the payment row, two ledger writes and the
    // audit log; the 5s default elapses on a cold connection.
    { timeout: 20_000 },
  );
}

/** Payment history for one PO, newest first. */
export async function listPurchaseOrderPayments(tenantId: string, purchaseOrderId: string) {
  const payments = await prisma.purchaseOrderPayment.findMany({
    where: { tenantId, purchaseOrderId },
    orderBy: { paidAt: 'desc' },
  });

  const accountIds = Array.from(new Set(payments.map((payment) => payment.paymentAccountId)));
  const accounts =
    accountIds.length > 0
      ? await prisma.paymentAccount.findMany({
          where: { id: { in: accountIds }, tenantId },
          select: { id: true, name: true, type: true },
        })
      : [];

  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  const paidTotal = payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0));

  return {
    payments: payments.map((payment) => ({
      ...payment,
      account: accountMap.get(payment.paymentAccountId) ?? null,
    })),
    paidTotal: money(paidTotal),
  };
}
