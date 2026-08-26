import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

import { processDueTrackingChecks } from '@/lib/services/tracking.service';

function isValidCronSecret(authHeader: string | null): boolean {
  const envSecret = process.env.CRON_SECRET;
  if (!envSecret || !authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;
  const a = Buffer.from(envSecret, 'utf-8');
  const b = Buffer.from(token, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
