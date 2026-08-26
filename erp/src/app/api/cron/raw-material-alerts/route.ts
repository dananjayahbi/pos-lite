import { NextRequest, NextResponse } from 'next/server';
import { isValidCronSecret } from '@/lib/cron-auth';
import { scanRawMaterialAlerts } from '@/lib/services/rawMaterialAlert.service';

/**
 * Scheduled Raw Material Alert job (doc 27).
 *
 * Scans all active tenants' raw materials, flags those at/below their low-stock
 * threshold, and creates factory/procurement notifications. Protected by the
 * shared `CRON_SECRET`. Trigger via your scheduler (e.g. Vercel Cron).
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
    const result = await scanRawMaterialAlerts();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('cron raw-material-alerts error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Raw-material alert scan failed' } },
      { status: 500 },
    );
  }
}
