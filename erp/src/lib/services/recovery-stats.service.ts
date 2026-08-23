import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Recovery staff-performance aggregation (doc 45). Aggregates `DeliveryRecovery`
 * rows by staff over a period so management can see how many failed orders each
 * staff member handled, how many were recovered (redelivered) vs permanently
 * cancelled, and the distribution of recovery actions.
 */

export interface RecoveryStaffRow {
  staffId: string;
  email: string;
  role: string;
  assignedFailed: number;
  followUpCalls: number;
  rescheduled: number;
  redelivered: number;
  cancelled: number;
  totalAttempts: number;
  recoveryRate: number;
}

export interface RecoveryStatsTotals {
  totalAttempts: number;
  totalAssignedFailed: number;
  totalRedelivered: number;
  totalCancelled: number;
  overallRecoveryRate: number;
}

export interface RecoveryStaffPerformance {
  staff: RecoveryStaffRow[];
  totals: RecoveryStatsTotals;
}

/**
 * Pure aggregation used by the report route (unit-tested). `attempts` are the
 * fetched `DeliveryRecovery` rows; `distinctStaffDeliveries` is the result of
 * grouping rows by (staffId, deliveryId) to count assigned failed orders.
 */
export function aggregateRecoveryStaff(
  attempts: Array<{
    staffId: string;
    action: string;
    staff?: { id: string; email: string; role: string } | null;
  }>,
  distinctStaffDeliveries: Array<{ staffId: string; deliveryId: string }>,
): RecoveryStaffPerformance {
  const byStaff = new Map<string, RecoveryStaffRow>();

  for (const attempt of attempts) {
    const staffId = attempt.staffId;
    let row = byStaff.get(staffId);
    if (!row) {
      row = {
        staffId,
        email: attempt.staff?.email ?? staffId,
        role: attempt.staff?.role ?? 'UNKNOWN',
        assignedFailed: 0,
        followUpCalls: 0,
        rescheduled: 0,
        redelivered: 0,
        cancelled: 0,
        totalAttempts: 0,
        recoveryRate: 0,
      };
      byStaff.set(staffId, row);
    }
    row.totalAttempts += 1;
    if (attempt.action === 'FOLLOW_UP_CALL') row.followUpCalls += 1;
    else if (attempt.action === 'RESCHEDULED') row.rescheduled += 1;
    else if (attempt.action === 'REDELIVERED') row.redelivered += 1;
    else if (attempt.action === 'CANCELLED') row.cancelled += 1;
  }

  // Assigned-failed is the distinct set of deliveries each staff acted on.
  for (const group of distinctStaffDeliveries) {
    const row = byStaff.get(group.staffId);
    if (row) row.assignedFailed += 1;
  }

  const staff = [...byStaff.values()].map((row) => {
    const actionable = row.redelivered + row.cancelled;
    row.recoveryRate = actionable === 0 ? 0 : Math.round((row.redelivered / actionable) * 1000) / 10;
    return row;
  });

  const totalRedelivered = staff.reduce((sum, r) => sum + r.redelivered, 0);
  const totalCancelled = staff.reduce((sum, r) => sum + r.cancelled, 0);
  const overallActionable = totalRedelivered + totalCancelled;

  return {
    staff,
    totals: {
      totalAttempts: staff.reduce((sum, r) => sum + r.totalAttempts, 0),
      totalAssignedFailed: staff.reduce((sum, r) => sum + r.assignedFailed, 0),
      totalRedelivered,
      totalCancelled,
      overallRecoveryRate:
        overallActionable === 0 ? 0 : Math.round((totalRedelivered / overallActionable) * 1000) / 10,
    },
  };
}

export async function getRecoveryStaffPerformance(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<RecoveryStaffPerformance> {
  const [attempts, distinctStaffDeliveries] = await Promise.all([
    prisma.deliveryRecovery.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      include: { staff: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deliveryRecovery.groupBy({
      by: ['staffId', 'deliveryId'],
      where: { tenantId, createdAt: { gte: from, lte: to } },
    }),
  ]);

  return aggregateRecoveryStaff(attempts, distinctStaffDeliveries);
}
