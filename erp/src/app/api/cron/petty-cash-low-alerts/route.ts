import { NextRequest, NextResponse } from 'next/server';
import { isValidCronSecret } from '@/lib/cron-auth';
import { scanPettyCashLowBalances } from '@/lib/services/petty-cash.service';

/**
 * Scheduled Petty-Cash Low-Balance Alert job (doc 40 Step 4).
 *
 * Scans all active funds and emits PETTY_CASH_LOW notifications when a balance
 * drops to/below its configured threshold — catching cases the transactional
 * check missed. Protected by the shared `CRON_SECRET`.
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
    const result = await scanPettyCashLowBalances();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('cron petty-cash-low-alerts error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Petty cash low-balance scan failed' } },
      { status: 500 },
    );
  }
}
