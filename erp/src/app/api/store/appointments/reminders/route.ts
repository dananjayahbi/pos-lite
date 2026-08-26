import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReminderHistory } from '@/lib/services/appointment-reminder.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const appointmentId = url.searchParams.get('appointmentId');

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'appointmentId parameter is required' } },
        { status: 400 },
      );
    }

    const reminders = await getReminderHistory(appointmentId);

    return NextResponse.json({ success: true, data: reminders });
  } catch (error) {
    console.error('GET /api/store/appointments/reminders error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
