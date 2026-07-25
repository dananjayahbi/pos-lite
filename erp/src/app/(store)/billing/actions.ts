"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@/generated/prisma/client";
import Decimal from "decimal.js";
import {
  buildPayhereCheckoutPayload,
  generateInvoiceNumber,
  PAYHERE_PAYMENT_URL,
} from "@/lib/billing/payhere.service";

export async function initiateCheckout(
  tenantId: string,
  planId: string,
  billingCycle: "monthly" | "annual",
) {
  const session = await auth();
  if (!session?.user?.id || session.user.tenantId !== tenantId) {
    return { success: false as const, error: "Unauthorized" };
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });
  if (!plan || !plan.isActive) {
    return { success: false as const, error: "Plan not found or inactive" };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!subscription) {
    return { success: false as const, error: "No subscription found" };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      users: {
        where: { role: "OWNER" },
        select: { email: true },
        take: 1,
      },
    },
  });
  if (!tenant) {
    return { success: false as const, error: "Tenant not found" };
  }

  const ownerUser = tenant.users[0] ?? { email: session.user.email ?? "" };

  const amount =
    billingCycle === "monthly"
      ? new Decimal(plan.monthlyPrice.toString())
      : new Decimal(plan.annualPrice.toString());

  const now = new Date();
  const periodDays = billingCycle === "monthly" ? 30 : 365;
  const billingPeriodStart = now;
  const billingPeriodEnd = new Date(
    now.getTime() + periodDays * 24 * 60 * 60 * 1000,
  );
  const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(tx);

    return tx.invoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        amount,
        currency: "LKR",
        status: InvoiceStatus.PENDING,
        billingPeriodStart,
        billingPeriodEnd,
        dueDate,
        invoiceNumber,
      },
    });
  });

  const payload = buildPayhereCheckoutPayload(
    invoice,
    subscription,
    { id: tenant.id, slug: tenant.slug, name: tenant.name },
    ownerUser,
  );

  return {
    success: true as const,
    data: {
      invoiceId: invoice.id,
      payhereUrl: PAYHERE_PAYMENT_URL,
      payload,
    },
  };
}
