import type { AppointmentStatus } from '@/generated/prisma/client';
import {
  APPOINTMENT_TERMINAL_STATUSES,
  isAppointmentStatusTransitionAllowed,
} from '@/lib/constants/appointments';

/**
 * ARGUS #120 — cancellation is a lifecycle transition, not a free-form write.
 *
 * The cancel endpoint used to stamp CANCELLED on any row: a COMPLETED visit
 * converted to a sale could be cancelled while its sale stayed COMPLETED, and
 * terminal rows could be re-cancelled. Cancelling is legal only from an active
 * state and never once a sale is attached — the sale is the record of money
 * collected, so it must be voided through the sale flow instead.
 *
 * Legacy data is deliberately NOT repaired automatically. Rows written before
 * this guard exist: four converted appointments sit in CANCELLED with their
 * COMPLETED sale still attached, and two Rs 500.50 booking deposits were never
 * returned. Repairing them means voiding a sale and moving customer credit, so
 * an operator must reconcile each one through its own documented flow (void the
 * sale from Sales, then issue store credit from the customer) — this module
 * only stops new occurrences.
 */
export type AppointmentCancellationBlockReason =
  | 'APPOINTMENT_HAS_SALE'
  | 'APPOINTMENT_NOT_CANCELLABLE';

export interface AppointmentCancellationSubject {
  status: AppointmentStatus;
  saleId?: string | null;
}

/** Active states: exactly the ones whose lifecycle edges include CANCELLED. */
export const CANCELLABLE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
];

export function appointmentCancellationBlockReason(
  subject: AppointmentCancellationSubject,
): AppointmentCancellationBlockReason | null {
  if (subject.saleId) return 'APPOINTMENT_HAS_SALE';
  // `from === to` is treated as a legal no-op by the transition map, so an
  // already-CANCELLED row needs the explicit terminal check.
  if (APPOINTMENT_TERMINAL_STATUSES.includes(subject.status)) {
    return 'APPOINTMENT_NOT_CANCELLABLE';
  }
  if (!isAppointmentStatusTransitionAllowed(subject.status, 'CANCELLED')) {
    return 'APPOINTMENT_NOT_CANCELLABLE';
  }
  return null;
}

/**
 * Where a booking deposit goes when the appointment is cancelled.
 *
 * - `NONE`               nothing was collected.
 * - `ALREADY_PAID`       the visit was settled (`isPaid`), so the deposit is
 *                        not outstanding — cancelling must not mint credit.
 * - `NO_CUSTOMER`        a walk-in has no ledger to credit; the deposit is
 *                        recorded in the cancellation audit for manual follow-up.
 * - `REFUND_TO_STORE_CREDIT` a linked customer receives the deposit as store
 *                        credit through `issueCredit` (balance + ledger note).
 */
export type AppointmentDepositDisposition =
  | 'NONE'
  | 'ALREADY_PAID'
  | 'NO_CUSTOMER'
  | 'REFUND_TO_STORE_CREDIT';

type Decimalish = { toString(): string } | number | string | null | undefined;

/** Prisma `Decimal`s render through `toString()`; absent/invalid → 0. */
function toAmount(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function appointmentDepositDisposition(subject: {
  depositAmount: Decimalish;
  isPaid?: boolean | null;
  customerId?: string | null;
}): AppointmentDepositDisposition {
  const deposit = toAmount(subject.depositAmount);
  if (deposit <= 0) return 'NONE';
  if (subject.isPaid) return 'ALREADY_PAID';
  if (!subject.customerId) return 'NO_CUSTOMER';
  return 'REFUND_TO_STORE_CREDIT';
}

export function appointmentDepositAmount(subject: { depositAmount: Decimalish }): number {
  const deposit = toAmount(subject.depositAmount);
  return deposit > 0 ? Math.round((deposit + Number.EPSILON) * 100) / 100 : 0;
}
