import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_STATUS_TRANSITIONS,
} from '@/lib/constants/appointments';
import {
  CANCELLABLE_APPOINTMENT_STATUSES,
  appointmentCancellationBlockReason,
  appointmentDepositAmount,
  appointmentDepositDisposition,
} from '@/lib/appointments/appointmentCancellation.core';
import type { AppointmentStatus } from '@/generated/prisma/client';

const ALL_STATUSES = Object.keys(APPOINTMENT_STATUS_TRANSITIONS) as AppointmentStatus[];

describe('appointmentCancellationBlockReason', () => {
  it('allows cancellation only from the active lifecycle states', () => {
    for (const status of CANCELLABLE_APPOINTMENT_STATUSES) {
      expect(appointmentCancellationBlockReason({ status, saleId: null })).toBeNull();
    }
  });

  it('blocks cancellation from every terminal state', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as AppointmentStatus[]) {
      expect(appointmentCancellationBlockReason({ status, saleId: null })).toBe(
        'APPOINTMENT_NOT_CANCELLABLE',
      );
    }
  });

  it('blocks a converted appointment even when its status is not terminal', () => {
    // Defence in depth: the sale, not the status, is the authoritative signal.
    expect(
      appointmentCancellationBlockReason({ status: 'CHECKED_IN', saleId: 'sale_1' }),
    ).toBe('APPOINTMENT_HAS_SALE');
  });

  it('reports the sale guard before the status guard', () => {
    expect(
      appointmentCancellationBlockReason({ status: 'COMPLETED', saleId: 'sale_1' }),
    ).toBe('APPOINTMENT_HAS_SALE');
  });

  it('keeps the cancellable set in sync with the lifecycle map', () => {
    const fromMap = ALL_STATUSES.filter((status) =>
      APPOINTMENT_STATUS_TRANSITIONS[status].includes('CANCELLED') && status !== 'CANCELLED',
    );
    expect(fromMap.sort()).toEqual([...CANCELLABLE_APPOINTMENT_STATUSES].sort());
    expect(CANCELLABLE_APPOINTMENT_STATUSES).not.toContain('CANCELLED');
  });
});

describe('appointmentDepositDisposition', () => {
  it('does nothing when no deposit was recorded', () => {
    expect(appointmentDepositDisposition({ depositAmount: 0, customerId: 'c1' })).toBe('NONE');
    expect(appointmentDepositDisposition({ depositAmount: null, customerId: 'c1' })).toBe('NONE');
    expect(appointmentDepositDisposition({ depositAmount: '0.00', customerId: 'c1' })).toBe('NONE');
  });

  it('refunds an unpaid deposit to a linked customer as store credit', () => {
    expect(
      appointmentDepositDisposition({ depositAmount: '500.50', isPaid: false, customerId: 'c1' }),
    ).toBe('REFUND_TO_STORE_CREDIT');
  });

  it('leaves a settled appointment alone', () => {
    expect(
      appointmentDepositDisposition({ depositAmount: 500.5, isPaid: true, customerId: 'c1' }),
    ).toBe('ALREADY_PAID');
  });

  it('records a walk-in deposit without crediting anyone', () => {
    expect(
      appointmentDepositDisposition({ depositAmount: 500.5, isPaid: false, customerId: null }),
    ).toBe('NO_CUSTOMER');
  });
});

describe('appointmentDepositAmount', () => {
  it('reads a Prisma Decimal-like value and rounds to paise', () => {
    expect(appointmentDepositAmount({ depositAmount: { toString: () => '500.505' } })).toBe(500.51);
  });

  it('floors nonsense to zero', () => {
    expect(appointmentDepositAmount({ depositAmount: 'not-a-number' })).toBe(0);
    expect(appointmentDepositAmount({ depositAmount: undefined })).toBe(0);
  });

  it('never returns a negative deposit', () => {
    expect(appointmentDepositAmount({ depositAmount: -10 })).toBe(0);
  });
});
