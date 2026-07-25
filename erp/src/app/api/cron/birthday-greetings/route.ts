import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get today's date in Sri Lanka timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  const todayMonth = Number(parts.find((p) => p.type === 'month')?.value);
  const todayDay = Number(parts.find((p) => p.type === 'day')?.value);

  // Query customers with matching birthday using raw SQL
  const customers = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      phone: string;
      tenantId: string;
      tenantName: string;
      tenantSettings: unknown;
    }>
  >`
    SELECT c.id, c.name, c.phone, c."tenantId",
           t.name as "tenantName", t.settings as "tenantSettings"
    FROM customers c
    JOIN tenants t ON t.id = c."tenantId"
    WHERE c."isActive" = true
      AND c."deletedAt" IS NULL
      AND c.birthday IS NOT NULL
      AND EXTRACT(MONTH FROM c.birthday) = ${todayMonth}
      AND EXTRACT(DAY FROM c.birthday) = ${todayDay}
  `;

  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    const firstName = customer.name.split(' ')[0] ?? '';
    const settings = customer.tenantSettings as Record<string, unknown> | null;
    const template = (settings?.birthdayMessage as string | undefined) ?? undefined;

    const message = template
      ? template.replaceAll('[name]', firstName).replaceAll('[storeName]', customer.tenantName)
      : `Happy Birthday ${firstName}! Thank you for being a valued customer at ${customer.tenantName}. We hope to see you soon!`;

    const result = await sendWhatsAppTextMessage(customer.phone, message);

    await prisma.birthdayGreetingLog.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        status: result.success ? 'SENT' : 'FAILED',
        ...(result.error ? { errorMessage: result.error } : {}),
      },
    });

    if (result.success) sent++;
    else failed++;
  }

  return NextResponse.json({ processed: customers.length, sent, failed });
}
