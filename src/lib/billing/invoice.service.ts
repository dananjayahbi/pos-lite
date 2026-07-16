import "server-only";

import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@/generated/prisma/client";
import { generateInvoiceNumber } from "@/lib/billing/payhere.service";

// ─── Auto-generate next billing invoice ─────────────────────────────────────

export async function autoGenerateNextInvoice(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription) return null;

  // Determine cycle length from period difference
  const periodMs =
    subscription.currentPeriodEnd.getTime() -
    subscription.currentPeriodStart.getTime();
  const isAnnual = periodMs > 180 * 24 * 60 * 60 * 1000; // > 6 months = annual

  const nextStart = new Date(
    subscription.currentPeriodEnd.getTime() + 24 * 60 * 60 * 1000,
  );
  const nextEnd = isAnnual
    ? new Date(
        nextStart.getFullYear() + 1,
        nextStart.getMonth(),
        nextStart.getDate(),
      )
    : new Date(
        nextStart.getFullYear(),
        nextStart.getMonth() + 1,
        nextStart.getDate(),
      );

  const amount = isAnnual
    ? subscription.plan.annualPrice
    : subscription.plan.monthlyPrice;
  const invoiceNumber = await generateInvoiceNumber();

  return prisma.invoice.create({
    data: {
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      amount,
      currency: "LKR",
      status: InvoiceStatus.PENDING,
      billingPeriodStart: nextStart,
      billingPeriodEnd: nextEnd,
      dueDate: nextEnd,
      invoiceNumber,
    },
  });
}

// ─── Stub: Generate PDF and email invoice ───────────────────────────────────

export async function generateAndEmailInvoicePdf(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { tenant: true, subscription: { include: { plan: true } } },
  });
  if (!invoice) return;

  // TODO: Generate PDF and email via Resend
  console.log(
    `[Invoice] PDF generation stub for invoice ${invoice.invoiceNumber}`,
  );
}
