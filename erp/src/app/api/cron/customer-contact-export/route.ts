import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidCronSecret } from '@/lib/cron-auth';
import { runCustomerContactExport } from '@/lib/services/customer-contact-export.service';
import {
  getContactExportConfig,
  getContactExportSchedule,
} from '@/lib/services/customer-contact-export.config';

/**
 * Scheduled Customer Contact Export job (doc 18).
 *
 * Runs on a configurable schedule (daily/weekly via `CONTACT_EXPORT_SCHEDULE`),
 * iterates active tenants, and compiles + delivers a customer contact list per
 * the configured scope/destination. Protected by the shared `CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 },
    );
  }

  const config = getContactExportConfig();
  const schedule = getContactExportSchedule();

  if (!config.enabled) {
    return NextResponse.json({ success: true, data: { skipped: true, reason: 'disabled' } });
  }

  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  const runs = [];
  let processed = 0;
  let failed = 0;

  for (const tenant of tenants) {
    try {
      const result = await runCustomerContactExport({ tenantId: tenant.id, actorRole: 'SYSTEM' });
      runs.push({ tenantName: tenant.name, ...result });
      processed++;
    } catch (error) {
      failed++;
      console.error(
        `[customer-contact-export] Failed for tenant ${tenant.id} (${tenant.name}):`,
        error,
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      schedule,
      destination: config.destination,
      scope: config.scope,
      processed,
      failed,
      runs,
    },
  });
}
