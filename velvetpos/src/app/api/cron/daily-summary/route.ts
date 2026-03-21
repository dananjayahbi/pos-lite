import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { composeDailySummaryEmail } from '@/lib/email/dailySummary';
import Decimal from 'decimal.js';

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

function getYesterdayRange(): { start: Date; end: Date } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const start = new Date(yesterday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(yesterday);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatCurrency(value: Decimal): string {
  return `Rs. ${value.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 },
    );
  }

  const { start, end } = getYesterdayRange();

  // Fetch active tenants with their OWNER users
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      slug: true,
      users: {
        where: { role: 'OWNER', isActive: true, deletedAt: null },
        select: { email: true },
      },
    },
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const tenant of tenants) {
    if (tenant.users.length === 0) continue;

    for (const owner of tenant.users) {
      processed++;

      try {
        // Idempotency: check if already sent today for this tenant+email
        const alreadySent = await prisma.dailySummaryLog.findFirst({
          where: {
            tenantId: tenant.id,
            recipientEmail: owner.email,
            status: 'SENT',
            sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });

        if (alreadySent) {
          sent++; // Count as already handled
          continue;
        }

        // a. Sale aggregate (COMPLETED, yesterday)
        const salesAgg = await prisma.sale.aggregate({
          where: {
            tenantId: tenant.id,
            status: 'COMPLETED',
            completedAt: { gte: start, lte: end },
          },
          _sum: { totalAmount: true },
          _count: { id: true },
        });

        const totalSales = new Decimal(salesAgg._sum.totalAmount?.toString() ?? '0');
        const transactionCount = salesAgg._count.id;

        // b. Top product: SaleLine groupBy variantId, top 1 by sum quantity
        const topProducts = await prisma.saleLine.groupBy({
          by: ['variantId', 'productNameSnapshot'],
          where: {
            sale: {
              tenantId: tenant.id,
              status: 'COMPLETED',
              completedAt: { gte: start, lte: end },
            },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 1,
        });

        const topProductName = topProducts[0]?.productNameSnapshot ?? null;
        const topProductQty = topProducts[0]?._sum.quantity ?? 0;

        // c. Latest shift for cash float (opening float of latest shift)
        const latestShift = await prisma.shift.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { openedAt: 'desc' },
          select: { openingFloat: true },
        });

        const cashFloat = new Decimal(latestShift?.openingFloat?.toString() ?? '0');

        // Compose email
        const html = composeDailySummaryEmail({
          tenantName: tenant.name,
          date: formatDate(start),
          totalSales: formatCurrency(totalSales),
          transactionCount,
          topProductName,
          topProductQty,
          cashFloat: formatCurrency(cashFloat),
          tenantSlug: tenant.slug,
        });

        // TODO: Replace console.log with Resend email sending when API key is available
        // e.g. await resend.emails.send({ from: '...', to: owner.email, subject: '...', html })
        console.log(`[daily-summary] Email for ${tenant.name} -> ${owner.email}:\n${html}`);

        await prisma.dailySummaryLog.create({
          data: {
            tenantId: tenant.id,
            recipientEmail: owner.email,
            status: 'SENT',
          },
        });

        sent++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await prisma.dailySummaryLog
          .create({
            data: {
              tenantId: tenant.id,
              recipientEmail: owner.email,
              status: 'FAILED',
              errorMessage,
            },
          })
          .catch(() => {
            // If logging itself fails, just continue
          });

        failed++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: { processed, sent, failed },
  });
}
