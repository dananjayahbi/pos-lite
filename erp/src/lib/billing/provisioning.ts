/**
 * Billing provisioning — the missing write path for a tenant's Subscription.
 *
 * BUG-70 (M30-01): `createTrialSubscription` existed with **zero callers**, so
 * no tenant ever received a Subscription row and the whole billing UI was
 * unreachable (`/billing` → `redirect('/')`, checkout → "No subscription
 * found"). This module is the single, reusable place that callers — the
 * superadmin tenant-create flow and `prisma/seed.ts` — go through, so the
 * trial policy lives in exactly one spot instead of being duplicated per call
 * site.
 *
 * Deliberately NOT `import "server-only"`: `subscription.service.ts` (whose
 * `createTrialSubscription` this wraps) has no such guard either, and the seed
 * runner (`tsx prisma/seed.ts`) must be able to import this module.
 */
import { prisma } from '@/lib/prisma';
import { createTrialSubscription } from '@/lib/billing/subscription.service';
import { TRIAL_PERIOD_DAYS } from '@/lib/billing/constants';

export { TRIAL_PERIOD_DAYS };

// ─── Trial policy (ASSUMPTION — client D-level answer still outstanding) ─────
// The trial policy question (duration / plan / auto-grace) is D-level and has
// NOT been answered by the client. The values below are therefore an explicit,
// least-surprising default chosen to match the trial/GRACE math that already
// exists and is QA-verified:
//   • duration      — 30 days, i.e. the exact value `createTrialSubscription`
//                     has always applied inline (`TRIAL_PERIOD_DAYS`). No
//                     behavioural change, just named.
//   • plan          — STARTER: the entry tier, and the same tier the checkout
//                     upgrade card offers. Resolved dynamically (below) rather
//                     than hard-coded by id, because `SubscriptionPlan.id` is
//                     a cuid that differs per database.
//   • auto-grace    — YES, implicit and unchanged: after the trial ends the
//                     existing `POST /api/cron/check-subscriptions` moves
//                     TRIAL → PAST_DUE at `trialEndsAt` and suspends only after
//                     `GRACE_PERIOD_DAYS` (7) more days. This module does not
//                     add a second grace mechanism — it inherits that one, so
//                     trial→past-due→suspend remains the single timeline.
// Treat this block as the one place to change when the client answers.
export const TRIAL_POLICY = {
  /** Trial length in days — matches `createTrialSubscription`'s 30d math. */
  durationDays: TRIAL_PERIOD_DAYS,
  /** Entry-tier key used when the tenant-create flow picks no explicit plan. */
  defaultPlanName: 'STARTER',
  /** Existing cron applies GRACE_PERIOD_DAYS after `trialEndsAt`. */
  autoGraceViaExistingCron: true,
  /** Client has not confirmed the policy — flagged so it is never implied. */
  assumedBecauseClientPolicyUnanswered: true,
} as const;

/**
 * Resolve the plan a new tenant's trial should use.
 *
 * Order: an explicitly requested (and active) plan → `TRIAL_POLICY.defaultPlanName`
 * → any active plan. Returns `null` when no active plan exists at all: the
 * caller then skips provisioning rather than throwing, because a fresh install
 * whose plans have not been seeded must still be able to create tenants.
 */
export async function resolveTrialPlanId(
  requestedPlanId?: string,
): Promise<string | null> {
  if (requestedPlanId) {
    const requested = await prisma.subscriptionPlan.findUnique({
      where: { id: requestedPlanId },
      select: { id: true, isActive: true },
    });
    if (requested?.isActive) return requested.id;
  }

  const preferred = await prisma.subscriptionPlan.findUnique({
    where: { name: TRIAL_POLICY.defaultPlanName },
    select: { id: true, isActive: true },
  });
  if (preferred?.isActive) return preferred.id;

  const fallback = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

/**
 * Idempotently give `tenantId` a TRIAL subscription.
 *
 * Safe to call on every tenant create *and* on every reseed: an existing
 * subscription is reported back untouched (`created: false`), so a QA round
 * that has already paid/cancelled a subscription is never silently reset by a
 * reseed. Returns `null` when no active plan is available (see
 * `resolveTrialPlanId`) — callers treat that as "billing not provisioned yet",
 * not as an error.
 */
export async function provisionTrialSubscription(
  tenantId: string,
  requestedPlanId?: string,
): Promise<{ subscriptionId: string; planId: string; created: boolean } | null> {
  const existing = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { id: true, planId: true },
  });
  if (existing) {
    return { subscriptionId: existing.id, planId: existing.planId, created: false };
  }

  const planId = await resolveTrialPlanId(requestedPlanId);
  if (!planId) return null;

  const subscription = await createTrialSubscription(tenantId, planId);
  return { subscriptionId: subscription.id, planId, created: true };
}

/**
 * Tenant-create safe wrapper: **never throws**.
 *
 * Billing provisioning is a side effect of tenant creation, so it must not be
 * able to hard-fail the create itself (a plan table that is empty or a
 * transient DB error would otherwise turn a successful tenant create into a
 * 500, losing the tenant *and* the owner account). Failures are logged and
 * swallowed; the tenant simply has no billing until a later create/reseed.
 */
export async function provisionTrialSubscriptionSafely(
  tenantId: string,
  requestedPlanId?: string,
): Promise<{ subscriptionId: string; planId: string; created: boolean } | null> {
  try {
    return await provisionTrialSubscription(tenantId, requestedPlanId);
  } catch (error) {
    console.error(
      `[billing-provisioning] trial subscription skipped for tenant ${tenantId}:`,
      error,
    );
    return null;
  }
}