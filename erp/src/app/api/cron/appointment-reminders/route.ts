import { NextRequest, NextResponse } from 'next/server';

import { isValidCronSecret } from '@/lib/cron-auth';
import { processPendingReminders } from '@/lib/services/appointment-reminder.service';

/**
 * M27-08/OBS-77: the appointment reminder pipeline was dead code — nothing
 * called `processPendingReminders`, so req 3.3's 24h reminders could never
 * fire. This cron route is the clock. Auth mirrors the other cron endpoints
 * (bearer `CRON_SECRET`, fail-closed). Scheduling the PENDING rows happens in
 * `createAppointment`; sending is honest — rows go SENT only on provider
 * success, otherwise FAILED with the reason (until INF-03 provides credentials
 * they will visibly stay PENDING/FAILED rather than fake-SENT).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await processPendingReminders();
    const sent = results.filter((r) => r.status === 'SENT').length;
    const failed = results.filter((r) => r.status === 'FAILED').length;
    return NextResponse.json({ success: true, data: { processed: results.length, sent, failed, results } });
  } catch (error) {
    console.error('GET /api/cron/appointment-reminders error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Reminder run failed' } },
      { status: 500 },
    );
  }
}