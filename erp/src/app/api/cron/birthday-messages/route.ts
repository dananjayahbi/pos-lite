import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidCronSecret } from '@/lib/cron-auth';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface BirthdayCustomerRow {
  id: string;
  name: string;
  phone: string;
  tenantId: string;
  lastBirthdayMessageSentYear: number | null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 },
    );
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentYear = now.getFullYear();

  const customers = await prisma.$queryRaw<BirthdayCustomerRow[]>`
    SELECT c."id", c."name", c."phone", c."tenantId", c."lastBirthdayMessageSentYear"
    FROM "customers" c
    WHERE EXTRACT(MONTH FROM c."birthday") = ${currentMonth}
      AND EXTRACT(DAY FROM c."birthday") = ${currentDay}
      AND (c."lastBirthdayMessageSentYear" IS NULL OR c."lastBirthdayMessageSentYear" != ${currentYear})
      AND c."deletedAt" IS NULL
      AND c."phone" IS NOT NULL
  `;

  if (customers.length === 0) {
    return NextResponse.json({
      success: true,
      data: { processed: 0, sent: 0, failed: 0, skipped: 0 },
    });
  }

  const tenantIds = [...new Set(customers.map(c => c.tenantId))];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true, settings: true },
  });

  const tenantMap = new Map(tenants.map(t => [t.id, t]));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const customer of customers) {
    const tenant = tenantMap.get(customer.tenantId);
    if (!tenant) {
      skipped++;
      continue;
    }

    const whatsapp = (tenant.settings as Record<string, unknown> | null)?.whatsapp as
      | { endpoint?: string; apiKey?: string }
      | undefined;

    if (!whatsapp?.endpoint || !whatsapp?.apiKey) {
      skipped++;
      continue;
    }

    const message = `Happy Birthday ${customer.name}! 🎂 Come celebrate with us at ${tenant.name} — show this message for a special treat.`;

    try {
      const response = await fetch(whatsapp.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whatsapp.apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              to: customer.phone,
              type: 'text',
              text: { body: message },
            },
          ],
        }),
      });

      if (!response.ok) {
        failed++;
        continue;
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastBirthdayMessageSentYear: currentYear },
      });

      sent++;
    } catch {
      failed++;
    }

    await delay(200);
  }

  return NextResponse.json({
    success: true,
    data: {
      processed: customers.length,
      sent,
      failed,
      skipped,
    },
  });
}
