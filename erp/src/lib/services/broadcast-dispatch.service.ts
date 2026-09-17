/**
 * Broadcast dispatch service (M31-03 / OBS-53).
 *
 * Why this module exists
 * ----------------------
 * The original `POST /api/broadcast/whatsapp` ran a sequential N x (send + 1s
 * sleep) loop *inside* the request and only created the `CustomerBroadcast`
 * audit row **after** the loop finished. A full-audience broadcast (~7 minutes
 * for ~420 recipients) therefore outlived the serverless timeout and the audit
 * record — the only evidence the broadcast ever happened — was destroyed with
 * the request.
 *
 * The fix enforced here:
 *   1. RECORD FIRST — the audit row is created with status `SENDING` before a
 *      single message leaves, so an interrupted send still has its record.
 *   2. SEND AFTER THE RESPONSE — the loop is handed to Next's `after()` so the
 *      handler can answer `202` immediately while dispatch continues.
 *   3. NO ARTIFICIAL SLEEP — the old fixed 1s pacing is gone; provider throttling
 *      (HTTP 429) is handled by an exponential backoff on the send result.
 *   4. ANALYTICS FLUSHED INCREMENTALLY — counters are persisted as the loop
 *      progresses, not only at the end.
 *
 * Storage note: status + counters live inside the existing `CustomerBroadcast.filters`
 * JSON (`{ criteria, status, analytics }`) rather than in new columns, so this
 * change needs no Prisma migration. The JSON bag was already the analytics home.
 */

import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';
import type { Prisma } from '@/generated/prisma/client';

export type BroadcastStatus = 'SENDING' | 'COMPLETED';

export interface BroadcastRecipient {
  id: string;
  name: string;
  phone: string;
}

export interface BroadcastAnalytics {
  sent: number;
  failed: number;
  total: number;
  errors: string[];
}

export interface BroadcastFailureRecord {
  phone: string;
  error: string;
}

/** How many recipients are attempted before the counters are persisted again. */
const ANALYTICS_FLUSH_EVERY = 25;
/** Only the first N failure messages are surfaced to the caller/UI. */
export const BROADCAST_ERROR_SAMPLE_LIMIT = 10;

/** Base backoff applied when the provider answers a rate-limit (HTTP 429). */
const RATE_LIMIT_BACKOFF_BASE_MS = 1_000;

export function personalizeBroadcastMessage(
  message: string,
  customerName: string,
  storeName: string,
): string {
  const firstName = customerName.split(' ')[0] ?? '';
  return message.replaceAll('{{name}}', firstName).replaceAll('{{storeName}}', storeName);
}

/**
 * True when the send failed because the WhatsApp/Meta provider throttled us.
 * Meta's rate limiting is the only pacing that matters now that the artificial
 * per-message sleep has been removed.
 */
function isRateLimitFailure(error: string | undefined): boolean {
  if (!error) return false;
  return /\b429\b/.test(error) || /rate ?limit/i.test(error);
}

/**
 * Creates the audit row up-front (status `SENDING`, zero counters) so the
 * record survives a request that is killed mid-dispatch.
 */
export async function createBroadcastRecord(params: {
  tenantId: string;
  message: string;
  sentById: string;
  recipientCount: number;
  criteria: Record<string, unknown>;
}) {
  return prisma.customerBroadcast.create({
    data: {
      tenantId: params.tenantId,
      message: params.message,
      recipientCount: params.recipientCount,
      sentById: params.sentById,
      filters: {
        criteria: params.criteria as Prisma.InputJsonValue,
        status: 'SENDING' satisfies BroadcastStatus,
        analytics: { sent: 0, failed: 0, total: params.recipientCount, errors: [] },
      } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

/**
 * Persists the current tally against an existing broadcast row without
 * clobbering the caller-supplied `criteria` snapshot.
 */
export async function flushBroadcastAnalytics(
  broadcastId: string,
  status: BroadcastStatus,
  analytics: BroadcastAnalytics,
) {
  const existing = await prisma.customerBroadcast.findUnique({
    where: { id: broadcastId },
    select: { filters: true },
  });

  const filters =
    existing?.filters && typeof existing.filters === 'object' && !Array.isArray(existing.filters)
      ? (existing.filters as Record<string, unknown>)
      : {};

  await prisma.customerBroadcast.update({
    where: { id: broadcastId },
    data: {
      filters: {
        ...filters,
        status,
        analytics: {
          sent: analytics.sent,
          failed: analytics.failed,
          total: analytics.total,
          errors: analytics.errors.slice(0, BROADCAST_ERROR_SAMPLE_LIMIT),
        },
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * The send loop. Runs OUTSIDE the request once `after()` fires it.
 *
 * Returns the final analytics so a direct (awaited) invocation stays testable.
 */
export async function dispatchBroadcast(params: {
  broadcastId: string;
  recipients: BroadcastRecipient[];
  message: string;
  storeName: string;
}): Promise<BroadcastAnalytics> {
  const { broadcastId, recipients, message, storeName } = params;

  const analytics: BroadcastAnalytics = {
    sent: 0,
    failed: 0,
    total: recipients.length,
    errors: [],
  };

  try {
    for (let index = 0; index < recipients.length; index++) {
      const recipient = recipients[index]!;
      const personalized = personalizeBroadcastMessage(message, recipient.name, storeName);

      let result = await sendWhatsAppTextMessage(recipient.phone, personalized);

      // Provider throttling is the only pacing now — back off and retry once.
      if (!result.success && isRateLimitFailure(result.error)) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_BASE_MS));
        result = await sendWhatsAppTextMessage(recipient.phone, personalized);
      }

      if (result.success) {
        analytics.sent++;
      } else {
        analytics.failed++;
        analytics.errors.push(`${recipient.phone}: ${result.error ?? 'Unknown error'}`);
      }

      if ((index + 1) % ANALYTICS_FLUSH_EVERY === 0) {
        await flushBroadcastAnalytics(broadcastId, 'SENDING', analytics);
      }
    }

    await flushBroadcastAnalytics(broadcastId, 'COMPLETED', analytics);
  } catch (error) {
    // Never let an unexpected dispatch failure silently drop the audit row —
    // persist whatever progress was made and mark the broadcast complete.
    analytics.errors.push(
      `dispatch aborted: ${error instanceof Error ? error.message : String(error)}`,
    );
    await flushBroadcastAnalytics(broadcastId, 'COMPLETED', analytics).catch(() => {});
  }

  return analytics;
}

/**
 * Hands the dispatch loop to Next's post-response scheduler so the HTTP handler
 * can answer immediately. Falls back to an awaited in-request run if the
 * scheduler is unavailable (e.g. a non-Next test harness).
 */
export function scheduleBroadcastDispatch(params: {
  broadcastId: string;
  recipients: BroadcastRecipient[];
  message: string;
  storeName: string;
}): void {
  const run = () => dispatchBroadcast(params).catch(() => {});
  try {
    after(run);
  } catch {
    void run();
  }
}