import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { convertAppointmentToSale } from '@/lib/services/appointment.service';
import { createCommissionRecord } from '@/lib/services/commission.service';
import { normalizeCommissionRate } from '@/lib/constants/commission-rate';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    // M27-02/BUG-86: conversion flips a status AND writes a financial Sale, so
    // it requires both editAppointment and the sales-create key.
    if (
      !hasPermission(session.user, PERMISSIONS.APPOINTMENT.editAppointment) ||
      !hasPermission(session.user, PERMISSIONS.SALE.createSale)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const sale = await convertAppointmentToSale(tenantId, id, session.user.id, session.user.role);

    // Commission side-effect — non-blocking, mirrors the POS sale route.
    try {
      const cashier = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { commissionRate: true },
      });
      // ARGUS #342: keep the same 0-100 contract as the staff API and engine.
      const rate = normalizeCommissionRate(cashier?.commissionRate);
      if (rate !== null && rate > 0) {
        await createCommissionRecord({
          tenantId,
          saleId: sale.id,
          userId: session.user.id,
          baseAmount: sale.totalAmount,
          commissionRate: rate.toString(),
        });
      } else if (rate === null && cashier?.commissionRate !== null && cashier?.commissionRate !== undefined) {
        console.warn('Skipping commission: stored rate is outside 0-100', {
          userId: session.user.id,
          commissionRate: String(cashier.commissionRate),
        });
      }
    } catch (commissionError) {
      console.warn('Commission record creation failed for appointment conversion:', commissionError);
    }

    return NextResponse.json({ success: true, data: sale }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/appointments/[id]/convert-to-sale error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (message === 'APPOINTMENT_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } },
        { status: 404 },
      );
    }

    if (message === 'APPOINTMENT_NOT_COMPLETED') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Only completed appointments can be converted to a sale' } },
        { status: 400 },
      );
    }

    if (message === 'ALREADY_CONVERTED') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'This appointment has already been converted to a sale' } },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    );
  }
}
