import { NextRequest, NextResponse } from 'next/server';
import { isValidCronSecret } from '@/lib/cron-auth';
import { scanBatchAlerts } from '@/lib/services/batchAlert.service';

/**
 * Scheduled Batch Expiry Alert job (doc 30).
 *
 * Scans all active tenants' batches, flags expired and near-expiry stock, and
 * creates inventory notifications. Protected by the shared `CRON_SECRET`.
 * Trigger via your scheduler (e.g. Vercel Cron).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 },
    );
  }

  try {
    const result = await scanBatchAlerts();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('cron batch-alerts error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Batch alert scan failed' } },
      { status: 500 },
    );
  }
}
