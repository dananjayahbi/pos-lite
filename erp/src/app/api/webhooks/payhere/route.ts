import { NextRequest, NextResponse } from "next/server";
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
import {
  verifyPayhereSignature,
  type PayhereSignatureRejection,
} from "@/lib/billing/payhere-signature";
import { processOrderPaymentStatus } from "@/lib/services/order-payment.service";

// ── PayHere IPN Webhook ────────────────────────────────────────────────────
// Receives Instant Payment Notifications from PayHere payment gateway.
//
// Always returns 200 — PayHere retries on non-200 responses (OBS-47). A
// rejection is therefore expressed IN THE BODY, never as a status code:
//   accepted => { received: true }
//   rejected => { received: false, signatureValid: false, reason: <code> }
// where reason distinguishes 'SECRET_NOT_CONFIGURED' (misconfigured deployment,
// BUG-71/M30-02) from 'BAD_SIGNATURE' (forged/tampered IPN) so ops can alert.
//
// INVARIANT (BUG-72/M30-03): the signature gate runs FIRST — before any DB
// read or write. A rejected IPN creates ZERO rows; the InvoicePaymentEvent
// financial ledger only ever holds verified payloads.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Always-200 acknowledgement. Extra fields are additive — callers that only
 * read `received` are unaffected.
 */
function accepted(extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ received: true, ...extra }, { status: 200 });
}

/**
 * Always-200 rejection. `received:false` + `signatureValid:false` + the
 * machine-readable `reason` make a dropped IPN distinguishable from an
 * accepted one without changing the HTTP contract PayHere retries against.
 * Nothing has been read from or written to the DB at this point.
 */
function rejected(reason: PayhereSignatureRejection): NextResponse {
  return NextResponse.json(
    { received: false, signatureValid: false, reason },
    { status: 200 },
  );
}

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

    // ─ Signature verification (GATE — first, before any DB access) ──────
    // `verifyPayhereSignature` owns the md5 algorithm and the rejection
    // taxonomy (see src/lib/billing/payhere-signature.ts). A missing secret is
    // warned about there, throttled so an IPN flood cannot spam logs/Sentry.
    const { valid: signatureValid, reason } = verifyPayhereSignature({
      merchantId: merchant_id,
      orderId: order_id,
      amount: payhere_amount,
      currency: payhere_currency,
      md5sig,
    });

    // Rejected → respond 200 (retry semantics) and stop. No invoice lookup, no
    // audit row, no order/subscription/tenant mutation (BUG-72).
    if (!signatureValid) {
      console.warn(
        "[PayHere IPN] Rejected IPN:",
        JSON.stringify({ order_id, status_code, reason }),
      );
      return rejected(reason);
    }

    // ─ Look up existing invoice ────────────────────────────────────────
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
            // Only verified payloads reach this write (the gate above), so the
            // ledger records the constant that follows from it.
            signatureValid: true,
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

    // ── Customer (website) order IPN ────────────────────────────────────
    // Order payments are sent with custom_2 = "order:<deliveryId>". Resolve
    // the delivery and update its payment status. Billing (invoice) payments
    // are the default path below.
    const custom2 = params.get("custom_2") ?? "";
    if (custom2.startsWith("order:")) {
      const deliveryId = custom2.slice("order:".length);
      try {
        const { updated, status } = await processOrderPaymentStatus(
          deliveryId,
          parseInt(status_code) || 0,
        );
        if (!updated) {
          console.warn(
            "[PayHere IPN] Order payment not updated:",
            deliveryId,
            "status:",
            status,
          );
        }
      } catch (e) {
        console.error("[PayHere IPN] Failed to process order payment:", e);
      }
      return accepted();
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
              // Verified: the gate above already rejected anything unsigned.
              signatureValid: true,
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

      return accepted();
    }

    if (!invoice) {
      console.error("[PayHere IPN] Unknown order_id:", order_id);
      return accepted();
    }

    // ── Duplicate protection ────────────────────────────────────────────
    if (invoice.status === InvoiceStatus.PAID) {
      console.log(
        "[PayHere IPN] Duplicate IPN for paid invoice:",
        invoice.id,
      );
      return accepted();
    }

    // ── Process payment status ──────────────────────────────────────────
    await processPaymentStatus(
      status_code,
      invoice.id,
      invoice.subscriptionId,
      invoice.tenantId,
      recurring,
    );

    return accepted();
  } catch (error) {
    console.error("[PayHere IPN] Unhandled error:", error);
    return accepted();
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
