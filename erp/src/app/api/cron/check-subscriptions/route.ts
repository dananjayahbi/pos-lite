import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma, SubscriptionStatus } from "@/generated/prisma/client";
import { GRACE_PERIOD_DAYS } from "@/lib/billing/constants";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runAt = new Date();
  const startMs = Date.now();

  let trialsExpired = 0;
  let subscriptionsSuspended = 0;
  let suspensionEmailsSent = 0;

  // Track freshly transitioned trial IDs to exclude from grace-period check
  const freshlyTransitionedIds: string[] = [];

  // ── Step 1: Expire overdue TRIAL subscriptions → PAST_DUE ──────────────

  const overdueTrials = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIAL,
      trialEndsAt: { lt: runAt },
    },
    include: { tenant: { select: { name: true } } },
  });

  for (const sub of overdueTrials) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      }),
      prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: sub.tenantId,
          actorRole: "SYSTEM",
          entityType: "Subscription",
          entityId: sub.id,
          action: "TRIAL_EXPIRED",
          before: { status: SubscriptionStatus.TRIAL } satisfies Prisma.JsonObject,
          after: { status: SubscriptionStatus.PAST_DUE } satisfies Prisma.JsonObject,
        },
      }),
    ]);

    freshlyTransitionedIds.push(sub.id);
    trialsExpired++;
    console.log(
      `[check-subscriptions] Trial expired for tenant "${sub.tenant.name}" (${sub.tenantId})`
    );
  }

  // ── Step 2 & 3: Check PAST_DUE subs — suspend if beyond grace period ──

  const pastDueSubs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.PAST_DUE,
      id: { notIn: freshlyTransitionedIds },
    },
    include: {
      tenant: {
        select: { name: true, users: { select: { email: true } } },
      },
    },
  });

  for (const sub of pastDueSubs) {
    const daysPastDue = Math.floor(
      (runAt.getTime() - sub.currentPeriodEnd.getTime()) / MS_PER_DAY
    );

    if (daysPastDue <= GRACE_PERIOD_DAYS) {
      continue;
    }

    // ── Step 3: Suspend beyond-grace subscription ──
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.SUSPENDED },
      }),
      prisma.tenant.update({
        where: { id: sub.tenantId },
        data: { subscriptionStatus: SubscriptionStatus.SUSPENDED },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: sub.tenantId,
          actorRole: "SYSTEM",
          entityType: "Subscription",
          entityId: sub.id,
          action: "SUBSCRIPTION_SUSPENDED",
          before: { status: SubscriptionStatus.PAST_DUE } satisfies Prisma.JsonObject,
          after: { status: SubscriptionStatus.SUSPENDED } satisfies Prisma.JsonObject,
        },
      }),
    ]);

    subscriptionsSuspended++;

    // ── Step 4: Send suspension email (stub) ──
    const emails = sub.tenant.users.map((u) => u.email);
    for (const email of emails) {
      try {
        // TODO: integrate Resend
        console.log(
          `[check-subscriptions] Suspension email sent to ${email} for tenant "${sub.tenant.name}" (${sub.tenantId})`
        );
        suspensionEmailsSent++;
      } catch (err) {
        console.error(
          `[check-subscriptions] Failed to send suspension email to ${email}:`,
          err
        );
      }
    }
  }

  // ── Step 5: Log long-term SUSPENDED (>30 days past grace) for review ───

  const longTermSuspended = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.SUSPENDED,
    },
    include: { tenant: { select: { name: true } } },
  });

  for (const sub of longTermSuspended) {
    const daysPastDue = Math.floor(
      (runAt.getTime() - sub.currentPeriodEnd.getTime()) / MS_PER_DAY
    );
    const daysBeyondGrace = daysPastDue - GRACE_PERIOD_DAYS;

    if (daysBeyondGrace > 30) {
      console.warn(
        `[check-subscriptions] REVIEW NEEDED: Tenant "${sub.tenant.name}" (${sub.tenantId}) suspended ${daysBeyondGrace} days beyond grace period`
      );
    }
  }

  const durationMs = Date.now() - startMs;

  return NextResponse.json({
    runAt: runAt.toISOString(),
    trialsExpired,
    subscriptionsSuspended,
    suspensionEmailsSent,
    durationMs,
  });
}
