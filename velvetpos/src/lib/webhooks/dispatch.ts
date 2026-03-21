import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

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

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      try {
        const signature = createHmac("sha256", endpoint.secret)
          .update(body)
          .digest("hex");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const responseText = await res.text().catch(() => null);

        await prisma.webhookDelivery.create({
          data: {
            webhookEndpointId: endpoint.id,
            event,
            payload: payload as object,
            statusCode: res.status,
            response: responseText?.slice(0, 1000) ?? null,
            status: res.ok ? "SUCCESS" : "FAILED",
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await prisma.webhookDelivery
          .create({
            data: {
              webhookEndpointId: endpoint.id,
              event,
              payload: payload as object,
              statusCode: null,
              response: message.slice(0, 1000),
              status: "FAILED",
            },
          })
          .catch(() => {});
      }
    }),
  );
}
