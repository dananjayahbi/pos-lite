import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

import { prisma } from '@/lib/prisma';
import { syncLocations } from '@/lib/services/location-sync.service';

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
