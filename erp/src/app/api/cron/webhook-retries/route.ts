import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { isValidCronSecret } from '@/lib/cron-auth';
import { deliverWebhook } from '@/lib/webhooks/send';
import { MAX_ATTEMPTS, isDeliveryDue } from '@/lib/webhooks/retry';
import { recordRetryOutcome } from '@/lib/webhooks/retry-schedule';

/**
 * M33-02 (OBS-62) — auto-retry sweep for FAILED webhook deliveries.
 *
 * Fail-closed: a missing/wrong `Authorization: Bearer <CRON_SECRET>` is a 401
 * before any database access, using the same shared timing-safe helper as the
 * other cron routes.
 *
 * Each retry calls `deliverWebhook`, which creates a NEW `WebhookDelivery` row
 * for the attempt — exactly mirroring the manual retry route. The no-duplication
 * guarantee is preserved because the original row is never replayed: it is only
 * annotated (`attempt` + `nextRetryAt`), so the ledgers never claim the same
 * attempt twice.
 */
const BATCH_SIZE = 25;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } },
      { status: 401 },
    );
  }

  try {
    const now = new Date();

    const candidates = await prisma.webhookDelivery.findMany({
      where: {
        status: 'FAILED',
        attempt: { lt: MAX_ATTEMPTS },
        nextRetryAt: { not: null, lte: now },
        webhookEndpoint: { isActive: true, deletedAt: null },
      },
      include: {
        webhookEndpoint: {
          select: { id: true, url: true, secret: true },
        },
      },
      orderBy: { nextRetryAt: 'asc' },
      take: BATCH_SIZE,
    });

    const due = candidates.filter((row) => isDeliveryDue(row, now));

    let retried = 0;
    let succeeded = 0;
    let exhausted = 0;

    for (const delivery of due) {
      const attempt = (delivery.attempt ?? 1) + 1;
      const payload =
        typeof delivery.payload === 'object' &&
        delivery.payload !== null &&
        !Array.isArray(delivery.payload)
          ? (delivery.payload as Record<string, unknown>)
          : { value: delivery.payload };

      const result = await deliverWebhook({
        webhookEndpointId: delivery.webhookEndpoint.id,
        url: delivery.webhookEndpoint.url,
        secret: delivery.webhookEndpoint.secret,
        event: delivery.event,
        payload,
        attempt,
        // The chain head carries the schedule; this attempt is a child row and
        // is accounted for on the head below, so it must not be swept again.
        scheduleRetry: false,
      });

      retried += 1;
      if (result.status === 'SUCCESS') succeeded += 1;

      const outcome = await recordRetryOutcome(delivery.id, attempt, result.status === 'SUCCESS');
      if (outcome.exhausted) exhausted += 1;
    }

    return NextResponse.json({
      success: true,
      data: { considered: candidates.length, retried, succeeded, exhausted, remaining: candidates.length - due.length },
    });
  } catch (error) {
    console.error('cron webhook-retries error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Webhook retry sweep failed' } },
      { status: 500 },
    );
  }
}