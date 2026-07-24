import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';

interface DeliverWebhookInput {
  webhookEndpointId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
}

export async function deliverWebhook({
  webhookEndpointId,
  url,
  secret,
  event,
  payload,
  timeoutMs = 5_000,
}: DeliverWebhookInput) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  let status: 'SUCCESS' | 'FAILED' = 'FAILED';
  let statusCode: number | null = null;
  let responseText: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    statusCode = response.status;
    responseText = await response.text().catch(() => null);
    status = response.ok ? 'SUCCESS' : 'FAILED';
  } catch (error) {
    responseText = error instanceof Error ? error.message : 'Unknown error';
  }

  return prisma.webhookDelivery.create({
    data: {
      webhookEndpointId,
      event,
      payload: payload as object,
      statusCode,
      response: responseText?.slice(0, 1000) ?? null,
      status,
    },
  });
}
