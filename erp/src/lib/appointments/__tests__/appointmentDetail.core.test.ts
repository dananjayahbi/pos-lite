import { describe, expect, it } from 'vitest';

import {
  buildAppointmentDetailView,
  type AppointmentDetailSource,
} from '@/lib/appointments/appointmentDetail.core';

function source(overrides: Partial<AppointmentDetailSource> = {}): AppointmentDetailSource {
  return {
    status: 'SCHEDULED',
    price: '2500.00',
    depositAmount: '0',
    isPaid: false,
    serviceName: 'Consultation',
    ...overrides,
  };
}

describe('buildAppointmentDetailView', () => {
  it('keeps the price visible when no service is attached', () => {
    const view = buildAppointmentDetailView(source({ serviceName: null, price: '1500.00' }));
    expect(view.hasService).toBe(false);
    expect(view.serviceLabel).toBe('No service selected');
    expect(view.price).toBe(1500);
    expect(view.paymentState).toBe('UNPAID');
    expect(view.balanceDue).toBe(1500);
  });

  it('reports deposit, paid and balance states', () => {
    const deposit = buildAppointmentDetailView(
      source({ depositAmount: '500.50', isPaid: false }),
    );
    expect(deposit.paymentState).toBe('DEPOSIT');
    expect(deposit.depositAmount).toBe(500.5);
    expect(deposit.balanceDue).toBe(1999.5);

    const paid = buildAppointmentDetailView(source({ depositAmount: '500.50', isPaid: true }));
    expect(paid.paymentState).toBe('PAID');
    expect(paid.balanceDue).toBe(0);
  });

  it('shows the linked sale and refuses conversion once a sale exists', () => {
    const view = buildAppointmentDetailView(
      source({ status: 'COMPLETED', saleId: 'sale_1234567890' }),
    );
    expect(view.paymentState).toBe('SALE_RECORDED');
    expect(view.saleId).toBe('sale_1234567890');
    expect(view.saleShortId).toBe('SALE_123');
    expect(view.canConvertToSale).toBe(false);
    expect(view.balanceDue).toBe(0);
  });

  it('accepts the loaded sale relation when the scalar id is absent', () => {
    const view = buildAppointmentDetailView(
      source({ status: 'COMPLETED', sale: { id: 'sale_from_relation' } }),
    );
    expect(view.saleShortId).toBe('SALE_FRO');
    expect(view.canConvertToSale).toBe(false);
  });

  it('allows conversion only for a COMPLETED appointment without a sale', () => {
    expect(buildAppointmentDetailView(source({ status: 'COMPLETED' })).canConvertToSale).toBe(true);
    expect(buildAppointmentDetailView(source({ status: 'IN_PROGRESS' })).canConvertToSale).toBe(false);
    expect(buildAppointmentDetailView(source({ status: 'CANCELLED' })).canConvertToSale).toBe(false);
  });

  it('surfaces cancellation reason, time and actor', () => {
    const view = buildAppointmentDetailView(
      source({
        status: 'CANCELLED',
        cancellationReason: 'Customer called',
        cancelledAt: '2026-10-29T04:00:00.000Z',
        cancelledByEmail: 'manager@example.com',
      }),
    );
    expect(view.cancellation).toEqual({
      reason: 'Customer called',
      at: '2026-10-29T04:00:00.000Z',
      byEmail: 'manager@example.com',
    });
  });

  it('does not show a cancellation block for an active appointment', () => {
    expect(buildAppointmentDetailView(source()).cancellation).toBeNull();
  });

  it('summarizes reminders with counts, next schedule and last send', () => {
    const view = buildAppointmentDetailView(
      source({
        reminders: [
          {
            scheduledFor: '2026-10-27T10:00:00.000Z',
            sentAt: '2026-10-27T10:00:00.000Z',
            status: 'SENT',
          },
          {
            scheduledFor: '2026-10-28T08:00:00.000Z',
            status: 'PENDING',
          },
          {
            scheduledFor: '2026-10-28T12:00:00.000Z',
            status: 'PENDING',
          },
          {
            scheduledFor: '2026-10-28T13:00:00.000Z',
            sentAt: '2026-10-28T13:05:00.000Z',
            status: 'SENT',
          },
          {
            scheduledFor: '2026-10-28T14:00:00.000Z',
            status: 'FAILED',
          },
        ],
      }),
    );

    expect(view.reminders).toEqual({
      total: 5,
      sent: 2,
      pending: 2,
      failed: 1,
      nextScheduledFor: '2026-10-28T08:00:00.000Z',
      lastSentAt: '2026-10-28T13:05:00.000Z',
    });
  });

  it('handles an appointment with no reminders', () => {
    expect(buildAppointmentDetailView(source()).reminders).toMatchObject({
      total: 0,
      sent: 0,
      pending: 0,
      failed: 0,
      nextScheduledFor: null,
      lastSentAt: null,
    });
  });
});
