import type { AppointmentStatus } from '@/generated/prisma/client';

/**
 * ARGUS #128 — one pure view model for the appointment detail panel.
 *
 * The panel used to render price only when a service was attached, and hid the
 * sale, cancellation and reminders entirely. This helper normalises those
 * fields so the UI and its tests agree on what "paid", "balance", "convertible"
 * and "reminder summary" mean.
 */
export type AppointmentPaymentState = 'SALE_RECORDED' | 'PAID' | 'DEPOSIT' | 'UNPAID';

export interface AppointmentDetailReminder {
  scheduledFor: string | Date;
  sentAt?: string | Date | null;
  status: string;
}

export interface AppointmentDetailSource {
  status: AppointmentStatus;
  price: number | string;
  depositAmount?: number | string | null;
  isPaid?: boolean | null;
  saleId?: string | null;
  /** Present when the API's `sale` relation is loaded. */
  sale?: { id: string } | null;
  serviceName?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | Date | null;
  cancelledByEmail?: string | null;
  reminders?: readonly AppointmentDetailReminder[];
}

export interface AppointmentReminderSummary {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  /** Earliest PENDING reminder, ISO string. */
  nextScheduledFor: string | null;
  /** Most recent sentAt, ISO string. */
  lastSentAt: string | null;
}

export interface AppointmentCancellationView {
  reason: string | null;
  at: string | null;
  byEmail: string | null;
}

export interface AppointmentDetailView {
  serviceLabel: string;
  hasService: boolean;
  price: number;
  depositAmount: number;
  balanceDue: number;
  paymentState: AppointmentPaymentState;
  paymentLabel: string;
  saleId: string | null;
  saleShortId: string | null;
  canConvertToSale: boolean;
  cancellation: AppointmentCancellationView | null;
  reminders: AppointmentReminderSummary;
}

function toAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function summarizeReminders(
  reminders: readonly AppointmentDetailReminder[] | undefined,
): AppointmentReminderSummary {
  const rows = reminders ?? [];
  let sent = 0;
  let pending = 0;
  let failed = 0;
  let nextScheduledFor: string | null = null;
  let nextTime = Number.POSITIVE_INFINITY;
  let lastSentAt: string | null = null;
  let lastSentTime = Number.NEGATIVE_INFINITY;

  for (const reminder of rows) {
    const status = reminder.status.toUpperCase();
    if (status === 'SENT') sent += 1;
    else if (status === 'PENDING') pending += 1;
    else if (status === 'FAILED') failed += 1;

    if (status === 'PENDING') {
      const scheduled = toIso(reminder.scheduledFor);
      const time = scheduled ? new Date(scheduled).getTime() : Number.NaN;
      if (Number.isFinite(time) && time < nextTime) {
        nextTime = time;
        nextScheduledFor = scheduled;
      }
    }

    if (reminder.sentAt) {
      const sentIso = toIso(reminder.sentAt);
      const time = sentIso ? new Date(sentIso).getTime() : Number.NaN;
      if (Number.isFinite(time) && time > lastSentTime) {
        lastSentTime = time;
        lastSentAt = sentIso;
      }
    }
  }

  return {
    total: rows.length,
    sent,
    pending,
    failed,
    nextScheduledFor,
    lastSentAt,
  };
}

const PAYMENT_LABELS: Record<AppointmentPaymentState, string> = {
  SALE_RECORDED: 'Sale recorded',
  PAID: 'Paid',
  DEPOSIT: 'Deposit taken',
  UNPAID: 'Unpaid',
};

export function buildAppointmentDetailView(
  source: AppointmentDetailSource,
): AppointmentDetailView {
  const price = toAmount(source.price);
  const depositAmount = toAmount(source.depositAmount);
  const saleId = source.saleId ?? source.sale?.id ?? null;

  const paymentState: AppointmentPaymentState = saleId
    ? 'SALE_RECORDED'
    : source.isPaid
      ? 'PAID'
      : depositAmount > 0
        ? 'DEPOSIT'
        : 'UNPAID';

  const balanceDue =
    paymentState === 'SALE_RECORDED' || paymentState === 'PAID'
      ? 0
      : Math.max(price - depositAmount, 0);

  const cancelledAt = toIso(source.cancelledAt);
  const cancellation =
    source.status === 'CANCELLED' || source.cancellationReason || cancelledAt
      ? {
          reason: source.cancellationReason ?? null,
          at: cancelledAt,
          byEmail: source.cancelledByEmail ?? null,
        }
      : null;

  return {
    serviceLabel: source.serviceName ?? 'No service selected',
    hasService: Boolean(source.serviceName),
    price,
    depositAmount,
    balanceDue,
    paymentState,
    paymentLabel: PAYMENT_LABELS[paymentState],
    saleId,
    saleShortId: saleId ? saleId.slice(0, 8).toUpperCase() : null,
    canConvertToSale: source.status === 'COMPLETED' && !saleId,
    cancellation,
    reminders: summarizeReminders(source.reminders),
  };
}
