import Decimal from 'decimal.js';

import { summarizeOpenCommission } from '@/lib/services/commission-allocation';
import type {
  CommissionRecordBalance,
  OpenCommissionRecord,
} from '@/lib/services/commission-allocation';

/**
 * ARGUS #372/#374 — payroll commission reservation and outstanding balance.
 *
 * A generated-but-unpaid run reserves the staff's open commission records by
 * linking them to a pending `CommissionPayout` (paymentAccountName carries this
 * marker until the run is marked paid). Payroll only pays the positive net
 * outstanding balance; a net-negative balance is carried forward untouched.
 */
export const PAYROLL_PENDING_ACCOUNT_PREFIX = 'PAYROLL_PENDING:';

export function payrollPendingMarker(runId: string): string {
  return `${PAYROLL_PENDING_ACCOUNT_PREFIX}${runId}`;
}

export function isPendingPayrollPayoutName(name: string | null | undefined): boolean {
  return typeof name === 'string' && name.startsWith(PAYROLL_PENDING_ACCOUNT_PREFIX);
}

/**
 * ARGUS #374: a voided sale carries no payable commission. Returned sales are
 * still eligible for the record-based netting (the negative clawback record
 * reduces the outstanding balance); only VOIDED is excluded outright.
 */
export function isPayrollEligibleCommissionSale(
  status: string | null | undefined,
): boolean {
  return status !== 'VOIDED';
}

export interface PayrollCommissionPlan {
  netOutstanding: Decimal;
  /** Never negative — payroll must not pay a negative commission balance. */
  payable: Decimal;
  records: OpenCommissionRecord[];
}

export function planPayrollCommission(
  records: ReadonlyArray<CommissionRecordBalance>,
): PayrollCommissionPlan {
  const { netOutstanding, records: openRecords } = summarizeOpenCommission([...records]);
  return {
    netOutstanding,
    payable: Decimal.max(netOutstanding, 0),
    records: openRecords,
  };
}
