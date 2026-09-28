import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';
import { computeNextRetryAt } from '@/lib/webhooks/retry';

/**
 * M33-02 (OBS-65) — ONE timeout for every webhook dispatch path.
 *
 * Previously `dispatchWebhooks` used 2 s while the manual retry and test
 * routes fell through to this function's 5 s default, so the SAME endpoint
 * could be FAILED on the inline path and SUCCESS on retry — inconsistent
 * semantics for identical conditions. 5 s is the safer ceiling for a receiver
 * doing real work; `dispatchWebhooks` stays fire-and-forget (it never blocks
 * the sale critical path), so the longer window costs nothing user-visible.
 */
export const WEBHOOK_TIMEOUT_MS = 5_000;

/**
 * M33-03 (OBS-64) — replay protection. The signature now covers
 * `${timestamp}.${body}` (Stripe's scheme), and the timestamp travels in the
 * `X-Webhook-Timestamp` header. A receiver rejects a timestamp outside its
 * tolerance window (convention: ±5 minutes), which makes a captured
 * body+signature pair useless after that window instead of replayable forever.
 */
export function signWebhookPayload(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

interface DeliverWebhookInput {
  webhookEndpointId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
  /** Attempt number this send represents (1 = original inline send). */
  attempt?: number;
  /**
   * M33-02 (OBS-62) — whether this send may enter the auto-retry queue.
   *
   * ONLY the initial inline send (from `dispatchWebhooks`) schedules a retry.
   * Every retry invocation passes `false`, so a retry's child row is never
   * itself swept: the chain-head row stays the single scheduler, which is what
   * guarantees the sweep can never re-send an event that a retry already sent.
   */
  scheduleRetry?: boolean;
}

export async function deliverWebhook({
  webhookEndpointId,
  url,
  secret,
  event,
  payload,
  timeoutMs = WEBHOOK_TIMEOUT_MS,
  attempt = 1,
  scheduleRetry = true,
}: DeliverWebhookInput) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(secret, timestamp, body);

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
        'X-Webhook-Timestamp': String(timestamp),
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
      // M33-02 (OBS-62): stamp the attempt and, when this send failed but
      // attempts remain, the next automatic retry time — this is what the
      // `cron/webhook-retries` sweep selects on. Retry invocations opt out so
      // the chain head remains the only scheduled row.
      attempt,
      nextRetryAt:
        scheduleRetry && status === 'FAILED' ? computeNextRetryAt(attempt) : null,
    },
  });
}
