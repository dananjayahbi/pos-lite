import "server-only";

import { type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import Decimal from "decimal.js";

// ─── PayHere Portal Configuration ───────────────────────────────────────────
// Dashboard: https://www.payhere.lk/merchant/
// Sandbox:   https://sandbox.payhere.lk/merchant/
// Required env vars:
//   PAYHERE_MERCHANT_ID   — Merchant ID from PayHere dashboard
//   PAYHERE_MERCHANT_SECRET — Used for MD5 signature verification
//   PAYHERE_SANDBOX        — "true" to use sandbox endpoints
//   NEXTAUTH_URL           — Base URL for return/cancel/notify URLs
// ────────────────────────────────────────────────────────────────────────────

export const PAYHERE_PAYMENT_URL =
  process.env.PAYHERE_SANDBOX === "true"
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";

export const PAYHERE_RECURRING_URL =
  process.env.PAYHERE_SANDBOX === "true"
    ? "https://sandbox.payhere.lk/merchant/v1/recurring/charge"
    : "https://www.payhere.lk/merchant/v1/recurring/charge";

export function buildPayhereCheckoutPayload(
  invoice: { id: string; amount: Decimal | { toString(): string } },
  subscription: { id: string; plan: { name: string } },
  tenant: { id: string; slug: string; name: string },
  ownerUser: { email: string },
): Record<string, string> {
  const amount = new Decimal(invoice.amount.toString()).toFixed(2);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return {
    merchant_id: process.env.PAYHERE_MERCHANT_ID || "",
    return_url: `${baseUrl}/${tenant.slug}/billing?status=success`,
    cancel_url: `${baseUrl}/${tenant.slug}/billing?status=cancelled`,
    notify_url: `${baseUrl}/api/webhooks/payhere`,
    order_id: invoice.id,
    items: `VelvetPOS ${subscription.plan.name} Plan — Subscription`,
    currency: "LKR",
    amount,
    first_name: ownerUser.email.split("@")[0] ?? "",
    last_name: "Owner",
    email: ownerUser.email,
    phone: "0000000000",
    address: tenant.name,
    city: "Colombo",
    country: "Sri Lanka",
    custom_1: tenant.id,
    custom_2: subscription.id,
  };
}

export async function generateInvoiceNumber(
  tx?: Prisma.TransactionClient,
): Promise<string> {
  const client = tx ?? prisma;
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  const count = await client.invoice.count({
    where: {
      createdAt: { gte: startOfYear, lt: endOfYear },
    },
  });

  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}
