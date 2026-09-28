import "server-only";

import { type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/utils/url";
import {
  getPayhereCheckoutUrl,
  getPayhereRestBaseUrl,
} from "@/lib/payments/payhere-config";
import { computeCheckoutHash, formatPayhereAmount } from "@/lib/payments/payhere-crypto";
import { getPayhereMerchantId } from "@/lib/payments/payhere-config";
import Decimal from "decimal.js";

// ─── PayHere Portal Configuration ───────────────────────────────────────────
// Dashboard: https://www.payhere.lk/merchant/
// Sandbox:   https://sandbox.payhere.lk/merchant/
//
// Hosts, credentials and the sandbox/live switch live in
// `src/lib/payments/payhere-config.ts` — this module re-exports the two URLs the
// billing UI needs so existing imports keep working.
// ────────────────────────────────────────────────────────────────────────────

export const PAYHERE_PAYMENT_URL = getPayhereCheckoutUrl();

export const PAYHERE_RECURRING_URL = `${getPayhereRestBaseUrl()}/recurring/charge`;

export function buildPayhereCheckoutPayload(
  invoice: { id: string; amount: Decimal | { toString(): string } },
  subscription: { id: string; plan: { name: string } },
  tenant: { id: string; slug: string; name: string },
  ownerUser: { email: string },
): Record<string, string> {
  const amount = formatPayhereAmount(new Decimal(invoice.amount.toString()).toFixed(2));
  const baseUrl = getBaseUrl();
  const merchantId = getPayhereMerchantId() ?? "";
  const currency = "LKR";

  return {
    merchant_id: merchantId,
    return_url: `${baseUrl}/${tenant.slug}/billing?status=success`,
    cancel_url: `${baseUrl}/${tenant.slug}/billing?status=cancelled`,
    notify_url: `${baseUrl}/api/webhooks/payhere`,
    order_id: invoice.id,
    items: `AyurPOS ${subscription.plan.name} Plan — Subscription`,
    currency,
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
    // Required by PayHere since 2023-01-16; computed server-side so the
    // merchant secret never reaches the browser.
    hash: computeCheckoutHash(process.env.PAYHERE_MERCHANT_SECRET ?? "", {
      merchantId,
      orderId: invoice.id,
      amount,
      currency,
    }),
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
