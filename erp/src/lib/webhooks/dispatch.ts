import { prisma } from '@/lib/prisma';
import { deliverWebhook } from '@/lib/webhooks/send';

// TODO: Add retry mechanism with exponential backoff for failed deliveries

export async function dispatchWebhooks(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      tenantId,
      isActive: true,
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
          timeoutMs: 2_000,
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
            },
          })
          .catch(() => {});
      }
    }),
  );
}
