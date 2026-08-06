import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { convertAppointmentToSale } from '@/lib/services/appointment.service';

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

    const { id } = await params;
    const sale = await convertAppointmentToSale(tenantId, id, session.user.id);

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
