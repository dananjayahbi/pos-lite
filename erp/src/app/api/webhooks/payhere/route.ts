import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  InvoiceStatus,
  SubscriptionStatus,
} from "@/generated/prisma/client";
import { generateInvoiceNumber } from "@/lib/billing/payhere.service";
import {
  autoGenerateNextInvoice,
  generateAndEmailInvoicePdf,
} from "@/lib/billing/invoice.service";

// ─── PayHere IPN Webhook ────────────────────────────────────────────────────
// Receives Instant Payment Notifications from PayHere payment gateway.
// Always returns 200 — PayHere retries on non-200 responses.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);

    const merchant_id = params.get("merchant_id") ?? "";
    const order_id = params.get("order_id") ?? "";
    const payhere_amount = params.get("payhere_amount") ?? "";
    const payhere_currency = params.get("payhere_currency") ?? "";
    const status_code = params.get("status_code") ?? "";
    const md5sig = params.get("md5sig") ?? "";
    const recurring = params.get("recurring") ?? "";
    const message_type = params.get("message_type") ?? "";

    console.log("[PayHere IPN]", {
      merchant_id,
      order_id,
      payhere_amount,
      status_code,
      message_type,
      md5sig: "REDACTED",
    });

    // ── Signature verification ──────────────────────────────────────────
    const secret = process.env.PAYHERE_MERCHANT_SECRET ?? "";
    const innerHash = createHash("md5")
      .update(secret.toUpperCase())
      .digest("hex");
    const expectedSig = createHash("md5")
      .update(
        merchant_id + order_id + payhere_amount + payhere_currency + innerHash,
      )
      .digest("hex");
    const signatureValid =
      expectedSig.toLowerCase() === md5sig.toLowerCase();

    if (!signatureValid) {
      console.warn("[PayHere IPN] Invalid signature for order:", order_id);
    }

    // ── Look up existing invoice ────────────────────────────────────────
    const invoice = await prisma.invoice.findUnique({
      where: { id: order_id },
      include: { subscription: true, tenant: true },
    });

    // Record audit event (InvoicePaymentEvent.invoiceId is required,
    // so we can only create the event if the invoice exists)
    if (invoice) {
      try {
        await prisma.invoicePaymentEvent.create({
          data: {
            invoiceId: invoice.id,
            payhereStatusCode: parseInt(status_code) || 0,
            payhereOrderId: order_id,
            payhereAmount: payhere_amount,
            payhereMd5sig: md5sig,
            signatureValid,
            rawPayload: rawBody,
          },
        });
      } catch (e) {
        console.error("[PayHere IPN] Failed to create audit event:", e);
      }
    } else {
      console.warn(
        "[PayHere IPN] No invoice found for order_id — skipping audit event:",
        order_id,
      );
    }

    // Stop processing if signature invalid
    if (!signatureValid) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── Recurring IPN — create invoice on the fly ───────────────────────
    if (message_type === "RECURRING" && !invoice) {
      const subscriptionId = params.get("custom_2") ?? "";
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (subscription) {
        const invoiceNumber = await generateInvoiceNumber();
        const periodStart = subscription.currentPeriodEnd;
        const periodEnd = new Date(
          periodStart.getTime() + 30 * 24 * 60 * 60 * 1000,
        );

        const newInvoice = await prisma.invoice.create({
          data: {
            tenantId: subscription.tenantId,
            subscriptionId: subscription.id,
            amount: payhere_amount,
            currency: payhere_currency || "LKR",
            status: InvoiceStatus.PENDING,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            dueDate: new Date(),
            invoiceNumber,
          },
        });

        // Record audit for the newly created invoice
        try {
          await prisma.invoicePaymentEvent.create({
            data: {
              invoiceId: newInvoice.id,
              payhereStatusCode: parseInt(status_code) || 0,
              payhereOrderId: order_id,
              payhereAmount: payhere_amount,
              payhereMd5sig: md5sig,
              signatureValid,
              rawPayload: rawBody,
            },
          });
        } catch (e) {
          console.error(
            "[PayHere IPN] Failed to create audit event for recurring:",
            e,
          );
        }

        await processPaymentStatus(
          status_code,
          newInvoice.id,
          subscription.id,
          subscription.tenantId,
          recurring,
        );
      } else {
        console.error(
          "[PayHere IPN] No subscription found for recurring IPN, custom_2:",
          subscriptionId,
        );
      }

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!invoice) {
      console.error("[PayHere IPN] Unknown order_id:", order_id);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── Duplicate protection ────────────────────────────────────────────
    if (invoice.status === InvoiceStatus.PAID) {
      console.log(
        "[PayHere IPN] Duplicate IPN for paid invoice:",
        invoice.id,
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── Process payment status ──────────────────────────────────────────
    await processPaymentStatus(
      status_code,
      invoice.id,
      invoice.subscriptionId,
      invoice.tenantId,
      recurring,
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[PayHere IPN] Unhandled error:", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

// ─── Process IPN status code ──────────────────────────────────────────────────

async function processPaymentStatus(
  statusCode: string,
  invoiceId: string,
  subscriptionId: string,
  tenantId: string,
  recurring: string,
) {
  if (statusCode === "2") {
    // Success
    await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: new Date(),
          payhereOrderId: invoiceId,
        },
      });

      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: inv.billingPeriodStart,
          currentPeriodEnd: inv.billingPeriodEnd,
          ...(recurring
            ? { payhereSubscriptionToken: recurring }
            : {}),
        },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: SubscriptionStatus.ACTIVE },
      });
    });

    // Fire-and-forget: generate PDF email and next invoice
    generateAndEmailInvoicePdf(invoiceId).catch((e) =>
      console.error("[PayHere IPN] PDF generation failed:", e),
    );
    autoGenerateNextInvoice(subscriptionId).catch((e) =>
      console.error("[PayHere IPN] Auto-generate next invoice failed:", e),
    );
  } else if (statusCode === "-1" || statusCode === "-2") {
    // Cancelled or failed
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.FAILED },
      });
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
      await tx.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
      });
    });
  }
  // status_code "0" = pending — no changes needed
}
