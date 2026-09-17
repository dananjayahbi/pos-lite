import { prisma } from '@/lib/prisma';
import { deliverWebhook } from '@/lib/webhooks/send';
import { computeNextRetryAt } from '@/lib/webhooks/retry';

// M33-02 (OBS-62): failed deliveries are now auto-retried by
// `GET /api/cron/webhook-retries` on an exponential backoff schedule.
// M33-02 (OBS-65): the inline path no longer overrides the timeout with 2 s —
// it uses the same `WEBHOOK_TIMEOUT_MS` as manual retry/test, so identical
// network conditions cannot produce different outcomes per path.
// Delivery stays fire-and-forget: `dispatchWebhooks` is awaited only by the
// post-response `after()` callback, never on the sale critical path.

export async function dispatchWebhooks(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      tenantId,
      isActive: true,
      // M33-03 (OBS-63): a soft-deleted endpoint must stop receiving events.
      deletedAt: null,
      events: { has: event },
    },
  });

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      try {
        await deliverWebhook({
          webhookEndpointId: endpoint.id,
          url: endpoint.url,
          secret: endpoint.secret,
          event,
          payload,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await prisma.webhookDelivery
          .create({
            data: {
              webhookEndpointId: endpoint.id,
              event,
              payload: payload as object,
              statusCode: null,
              response: message.slice(0, 1000),
              status: 'FAILED',
              attempt: 1,
              nextRetryAt: computeNextRetryAt(1),
            },
          })
          .catch(() => {});
      }
    }),
  );
}
