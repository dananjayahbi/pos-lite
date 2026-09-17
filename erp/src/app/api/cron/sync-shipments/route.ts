import { NextRequest, NextResponse } from 'next/server';

import { processDueTrackingChecks } from '@/lib/services/tracking.service';
import { isValidCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 },
    );
  }

  try {
    const result = await processDueTrackingChecks();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('cron sync-shipments error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Shipment sync failed' } },
      { status: 500 },
    );
  }
}
