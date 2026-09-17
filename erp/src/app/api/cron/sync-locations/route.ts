import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { syncLocations } from '@/lib/services/location-sync.service';
import { isValidCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 },
    );
  }

  const tenants = await prisma.courierAccount.findMany({
    where: { isActive: true },
    select: { tenantId: true },
  });

  let synced = 0;
  let failed = 0;
  for (const { tenantId } of tenants) {
    try {
      await syncLocations(tenantId);
      synced++;
    } catch (error) {
      failed++;
      console.warn(`Location sync failed for tenant ${tenantId}:`, error);
    }
  }

  return NextResponse.json({ success: true, data: { synced, failed } });
}
