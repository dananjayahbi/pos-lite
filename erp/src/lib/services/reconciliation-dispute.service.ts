import 'server-only';

import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import type {
  DisputeStatus,
  ReconciliationStatus,
} from '@/generated/prisma/client';

/**
 * Reconciliation dispute service (doc 17).
 *
 * Opens / updates / closes disputes against reconciled ledger entries. Opening a
 * dispute flips the linked ledger entry to `DISPUTED`; resolving it (accepted /
 * rejected) reconciles the entry's status. Keeps an audit trail for every action.
 */

export interface OpenDisputeInput {
  tenantId: string;
  ledgerEntryId: string;
  openedById: string;
  reason: string;
  disputedAmount: number;
}

/** Open a dispute for a ledger entry, flipping the entry to DISPUTED. */
export async function openDispute(input: OpenDisputeInput) {
  setSentryTenantContext({ tenantId: input.tenantId });

  const entry = await prisma.reconciliationLedgerEntry.findFirst({
    where: { id: input.ledgerEntryId, tenantId: input.tenantId },
  });
  if (!entry) throw new Error('LEDGER_ENTRY_NOT_FOUND');
  if (entry.status === 'DISPUTED') throw new Error('ALREADY_DISPUTED');

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.reconciliationDispute.create({
      data: {
        tenantId: input.tenantId,
        ledgerEntryId: input.ledgerEntryId,
        openedById: input.openedById,
        reason: input.reason,
        disputedAmount: input.disputedAmount,
        status: 'OPEN',
      },
    });
    await tx.reconciliationLedgerEntry.update({
      where: { id: input.ledgerEntryId },
      data: { status: 'DISPUTED' as ReconciliationStatus },
    });
    return created;
  });

  void createAuditLog({
    tenantId: input.tenantId,
    actorId: input.openedById,
    actorRole: 'UNKNOWN',
    entityType: 'ReconciliationDispute',
    entityId: dispute.id,
    action: AUDIT_ACTIONS.RECONCILIATION_IMPORTED,
    after: { ledgerEntryId: input.ledgerEntryId, disputedAmount: input.disputedAmount },
  });

  return dispute;
}

export interface UpdateDisputeInput {
  tenantId: string;
  disputeId: string;
  actorId: string;
  status: DisputeStatus;
  resolutionNote?: string | null;
}

/**
 * Transition a dispute and reconcile its ledger entry when it resolves.
 * ACCEPTED/REJECTED/CLOSED are terminal — the entry is returned to a
 * reconciliation status (PARTIAL_MATCH for accepted, DISCREPANCY otherwise).
 */
export async function updateDispute(input: UpdateDisputeInput) {
  setSentryTenantContext({ tenantId: input.tenantId });

  const dispute = await prisma.reconciliationDispute.findFirst({
    where: { id: input.disputeId, tenantId: input.tenantId },
  });
  if (!dispute) throw new Error('DISPUTE_NOT_FOUND');

  const terminal: DisputeStatus[] = ['ACCEPTED', 'REJECTED', 'CLOSED'];
  const isTerminal = terminal.includes(input.status);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.reconciliationDispute.update({
      where: { id: dispute.id },
      data: {
        status: input.status,
        resolutionNote: input.resolutionNote ?? dispute.resolutionNote,
        resolvedById: isTerminal ? input.actorId : null,
        resolvedAt: isTerminal ? new Date() : null,
      },
    });
    if (isTerminal) {
      await tx.reconciliationLedgerEntry.update({
        where: { id: dispute.ledgerEntryId },
        data: {
          status:
            input.status === 'ACCEPTED'
              ? ('PARTIAL_MATCH' as ReconciliationStatus)
              : ('DISCREPANCY' as ReconciliationStatus),
        },
      });
    }
    return result;
  });

  void createAuditLog({
    tenantId: input.tenantId,
    actorId: input.actorId,
    actorRole: 'UNKNOWN',
    entityType: 'ReconciliationDispute',
    entityId: dispute.id,
    action: AUDIT_ACTIONS.RECONCILIATION_IMPORTED,
    after: { status: input.status },
  });

  return updated;
}

/** List disputes for a tenant, optionally filtered by status, with entry context. */
export async function listDisputes(tenantId: string, status?: DisputeStatus) {
  const where: { tenantId: string; status?: DisputeStatus } = { tenantId };
  if (status) where.status = status;

  return prisma.reconciliationDispute.findMany({
    where,
    include: {
      ledgerEntry: {
        select: {
          id: true,
          expectedCod: true,
          status: true,
          delivery: { select: { orderRef: true } },
        },
      },
      openedBy: { select: { email: true } },
      resolvedBy: { select: { email: true } },
    },
    orderBy: { openedAt: 'desc' },
  });
}

/** Count of open (non-terminal) disputes, for dashboard workload surfacing. */
export async function getOpenDisputeCount(tenantId: string): Promise<number> {
  return prisma.reconciliationDispute.count({
    where: {
      tenantId,
      status: { in: ['OPEN', 'UNDER_REVIEW'] },
    },
  });
}
