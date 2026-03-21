import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  InvoiceStatus,
  SubscriptionStatus,
  PaymentReminderType,
  PaymentReminderChannel,
  PaymentReminderSendStatus,
  UserRole,
} from "@/generated/prisma/client";

// ── Date helpers (no date-fns) ───────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Phone normalization (stub for future WhatsApp integration) ───────────────

function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return "94" + digits.slice(1);
  }
  if (digits.startsWith("94") && digits.length === 11) {
    return digits;
  }
  return null;
}

// ── Auth helper ──────────────────────────────────────────────────────────────

function isValidCronSecret(authHeader: string | null): boolean {
  const envSecret = process.env.CRON_SECRET;
  if (!envSecret || !authHeader) return false;

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return false;

  try {
    const a = Buffer.from(envSecret, "utf-8");
    const b = Buffer.from(token, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatAmount(amount: unknown): string {
  return `LKR ${Number(amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Reminder processing ─────────────────────────────────────────────────────

async function sendReminders(
  type: PaymentReminderType,
  invoices: Awaited<
    ReturnType<
      typeof prisma.invoice.findMany<{
        include: {
          tenant: {
            select: {
              name: true;
              slug: true;
              users: { where: { role: typeof UserRole.OWNER }; select: { email: true }; take: 1 };
            };
          };
        };
      }>
    >
  >,
): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  let sent = 0;
  let failed = 0;

  for (const invoice of invoices) {
    try {
      // Dedup: skip if same type reminder already sent today for this invoice
      const existing = await prisma.paymentReminder.findFirst({
        where: {
          invoiceId: invoice.id,
          type,
          sentAt: { gte: todayStart, lte: todayEnd },
        },
      });

      if (existing) continue;

      const ownerEmail = invoice.tenant.users[0]?.email ?? "unknown";
      const billingUrl = `${process.env.NEXTAUTH_URL}/${invoice.tenant.slug}/billing`;

      // Build message based on type
      let message: string;
      switch (type) {
        case PaymentReminderType.THREE_DAY_REMINDER:
          message =
            `[WhatsApp Stub] 3-day reminder for ${invoice.tenant.name} (${ownerEmail}): ` +
            `Invoice ${invoice.invoiceNumber} for ${formatAmount(invoice.amount)} is due on ${formatDate(invoice.dueDate)}. ` +
            `Pay at: ${billingUrl}`;
          break;
        case PaymentReminderType.DUE_DATE_REMINDER:
          message =
            `[WhatsApp Stub] Due-date reminder for ${invoice.tenant.name} (${ownerEmail}): ` +
            `Invoice ${invoice.invoiceNumber} for ${formatAmount(invoice.amount)} is due TODAY. ` +
            `Pay at: ${billingUrl}`;
          break;
        case PaymentReminderType.OVERDUE_REMINDER:
          message =
            `[WhatsApp Stub] Overdue reminder for ${invoice.tenant.name} (${ownerEmail}): ` +
            `Invoice ${invoice.invoiceNumber} for ${formatAmount(invoice.amount)} was due on ${formatDate(invoice.dueDate)} and is now overdue. ` +
            `Pay immediately at: ${billingUrl}`;
          break;
      }

      // Stub: log instead of sending via WhatsApp Cloud API
      console.log(`[payment-reminders] ${message}`);

      await prisma.paymentReminder.create({
        data: {
          tenantId: invoice.tenantId,
          invoiceId: invoice.id,
          type,
          sentAt: now,
          channel: PaymentReminderChannel.WHATSAPP,
          status: PaymentReminderSendStatus.SENT,
        },
      });

      sent++;
    } catch (err) {
      failed++;
      console.error(
        `[payment-reminders] Failed to process ${type} for invoice ${invoice.id}:`,
        err,
      );
    }
  }

  return { sent, failed };
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runAt = new Date();

  try {
    const now = new Date();
    const threeDaysFromNow = addDays(now, 3);

    const invoiceInclude = {
      tenant: {
        select: {
          name: true,
          slug: true,
          users: {
            where: { role: UserRole.OWNER },
            select: { email: true },
            take: 1,
          },
        },
      },
    } as const;

    // ── Pass 1: 3-day reminders ──────────────────────────────────────────
    const threeDayInvoices = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PENDING,
        dueDate: {
          gte: startOfDay(threeDaysFromNow),
          lte: endOfDay(threeDaysFromNow),
        },
      },
      include: invoiceInclude,
    });

    const threeDayResult = await sendReminders(
      PaymentReminderType.THREE_DAY_REMINDER,
      threeDayInvoices,
    );

    // ── Pass 2: Due-date reminders ───────────────────────────────────────
    const dueDateInvoices = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PENDING,
        dueDate: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
      include: invoiceInclude,
    });

    const dueDateResult = await sendReminders(
      PaymentReminderType.DUE_DATE_REMINDER,
      dueDateInvoices,
    );

    // ── Pass 3: Overdue reminders ────────────────────────────────────────
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PENDING,
        dueDate: { lt: startOfDay(now) },
        subscription: {
          status: SubscriptionStatus.PAST_DUE,
        },
      },
      include: invoiceInclude,
    });

    const overdueResult = await sendReminders(
      PaymentReminderType.OVERDUE_REMINDER,
      overdueInvoices,
    );

    const summary = {
      runAt: runAt.toISOString(),
      threeDayRemindersSent: threeDayResult.sent,
      dueDateRemindersSent: dueDateResult.sent,
      overdueRemindersSent: overdueResult.sent,
      failureCount:
        threeDayResult.failed + dueDateResult.failed + overdueResult.failed,
    };

    console.log("[payment-reminders] Run complete:", summary);

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[payment-reminders] Cron job failed:", err);
    return NextResponse.json({
      runAt: runAt.toISOString(),
      threeDayRemindersSent: 0,
      dueDateRemindersSent: 0,
      overdueRemindersSent: 0,
      failureCount: -1,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
