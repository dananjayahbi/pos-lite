import { describe, expect, it } from 'vitest';
import { summarizeAppointmentRevenue } from '@/lib/appointments/appointmentRevenue.core';

describe('summarizeAppointmentRevenue', () => {
  it('counts a paid visit at its full price once', () => {
    const summary = summarizeAppointmentRevenue({
      paidPrice: 2500,
      unpaidDeposits: 0,
      completedUnpaidPrice: 0,
      completedUnpaidDeposits: 0,
    });

    expect(summary.revenue).toBe(2500);
    expect(summary.depositsHeld).toBe(0);
    expect(summary.outstandingBalance).toBe(0);
  });

  it('counts only the deposit for a completed visit nobody paid for', () => {
    const summary = summarizeAppointmentRevenue({
      paidPrice: 0,
      unpaidDeposits: 500.5,
      completedUnpaidPrice: 2500,
      completedUnpaidDeposits: 500.5,
    });

    expect(summary.revenue).toBe(500.5);
    expect(summary.depositsHeld).toBe(500.5);
    expect(summary.outstandingBalance).toBe(1999.5);
  });

  it('adds paid visits and held deposits without double counting', () => {
    const summary = summarizeAppointmentRevenue({
      paidPrice: 2500,
      unpaidDeposits: 500.5,
      completedUnpaidPrice: 2500,
      completedUnpaidDeposits: 500.5,
    });

    expect(summary.revenue).toBe(3000.5);
  });

  it('reads Prisma Decimal-like and string aggregates', () => {
    const summary = summarizeAppointmentRevenue({
      paidPrice: { toString: () => '1264.20' },
      unpaidDeposits: '227.56',
      completedUnpaidPrice: null,
      completedUnpaidDeposits: undefined,
    });

    expect(summary.revenue).toBe(1491.76);
  });

  it('never reports a negative balance when the deposit covers the price', () => {
    const summary = summarizeAppointmentRevenue({
      paidPrice: 0,
      unpaidDeposits: 3000,
      completedUnpaidPrice: 2500,
      completedUnpaidDeposits: 3000,
    });

    expect(summary.outstandingBalance).toBe(0);
  });

  it('floors malformed aggregates to zero', () => {
    const summary = summarizeAppointmentRevenue({
      paidPrice: 'not-a-number',
      unpaidDeposits: undefined,
    });

    expect(summary).toEqual({ revenue: 0, depositsHeld: 0, outstandingBalance: 0 });
  });
});
