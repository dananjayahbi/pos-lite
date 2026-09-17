import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { composeDailySummaryEmail } from '@/lib/email/dailySummary';
import { sendEmail } from '@/lib/services/email.service';
import Decimal from 'decimal.js';
import { isValidCronSecret } from '@/lib/cron-auth';

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
  let pending = 0;
  let failed = 0;

  for (const tenant of tenants) {
    if (tenant.users.length === 0) continue;

    for (const owner of tenant.users) {
      processed++;

      try {
        // Idempotency: a summary already handled today is not re-sent. SENT and
        // PENDING both count as handled (PENDING == provider absent, so a second
        // run today must not pile up duplicate rows); a FAILED row is retried.
        const alreadyHandled = await prisma.dailySummaryLog.findFirst({
          where: {
            tenantId: tenant.id,
            recipientEmail: owner.email,
            status: { in: ['SENT', 'PENDING'] },
            sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });

        if (alreadyHandled) {
          // Count as already handled — under the status it actually carries.
          if (alreadyHandled.status === 'SENT') sent++; else pending++;
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

        // M35-02 (OBS-73): actually attempt delivery. Previously this was a
        // `console.log` followed by an unconditional `status: 'SENT'` write — a
        // false-success ledger claiming emails that were never sent (the same
        // anti-pattern family as BUG-11/73). The outcome is now recorded as
        // observed: SENT only on a real delivery, PENDING when the provider is
        // simply not configured (retryable once INF-03 supplies the key), and
        // FAILED when the provider was configured but rejected the send.
        const result = await sendEmail(
          owner.email,
          `Daily Summary — ${formatDate(start)}`,
          html,
        );

        if (result.delivered) {
          await prisma.dailySummaryLog.create({
            data: {
              tenantId: tenant.id,
              recipientEmail: owner.email,
              status: 'SENT',
            },
          });
          sent++;
        } else {
          // Not delivered: never claim SENT. `provider-not-configured` is a
          // PENDING (nothing is broken, the integration is absent); anything
          // else is a real FAILED.
          const notConfigured = result.reason === 'provider-not-configured';
          await prisma.dailySummaryLog.create({
            data: {
              tenantId: tenant.id,
              recipientEmail: owner.email,
              status: notConfigured ? 'PENDING' : 'FAILED',
              errorMessage: notConfigured
                ? 'Email provider not configured (RESEND_API_KEY unset) — not sent'
                : `Email provider error (${result.reason ?? 'unknown'})`,
            },
          });
          if (notConfigured) pending++; else failed++;
        }
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
    data: { processed, sent, pending, failed },
  });
}
