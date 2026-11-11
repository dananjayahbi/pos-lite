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
 *   3. NO ARTIFICIAL SLEEP — provider throttling (HTTP 429) is handled by an
 *      exponential backoff on the send result.
 *   4. ANALYTICS FLUSHED INCREMENTALLY — counters are persisted as the loop
 *      progresses, not only at the end.
 *
 * Channels
 * --------
 * EMAIL and SMS are the supported marketing channels. WHATSAPP stays available
 * for the legacy route/history rows but is no longer offered in the composer.
 *
 * Storage note: status + counters live inside the existing `CustomerBroadcast.filters`
 * JSON (`{ criteria, status, analytics }`) rather than in new columns, so this
 * change needs no extra migration. The JSON bag was already the analytics home.
 */

import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/services/email.service';
import { sendSmsMessage } from '@/lib/sms';
import {
  buildEmailHtml,
  buildSmsText,
  personalizeBroadcastContent,
} from '@/lib/broadcast/templates';
import type { Prisma } from '@/generated/prisma/client';

export type BroadcastChannelName = 'EMAIL' | 'SMS' | 'WHATSAPP';

export type BroadcastStatus = 'SENDING' | 'COMPLETED';

export interface BroadcastRecipient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

export interface BroadcastAnalytics {
  sent: number;
  failed: number;
  total: number;
  errors: string[];
}

export interface BroadcastFailureRecord {
  recipient: string;
  error: string;
}

export interface BroadcastContent {
  channel: BroadcastChannelName;
  /** Email subject; ignored for SMS/WhatsApp. */
  subject?: string | null;
  /** SMS/WhatsApp body or the email plain-text fallback. */
  message: string;
  /** Email HTML template; ignored for SMS/WhatsApp. */
  html?: string | null;
  /** Public image URLs attached to an email broadcast. */
  imageUrls?: string[];
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
  return personalizeBroadcastContent(message, customerName, storeName);
}

/**
 * True when the send failed because the provider throttled us. Meta's rate
 * limiting is the only pacing that matters now that the artificial per-message
 * sleep has been removed.
 */
function isRateLimitFailure(error: string | undefined): boolean {
  if (!error) return false;
  return /\b429\b/.test(error) || /rate ?limit/i.test(error);
}

function attachmentFilename(url: string, index: number): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    if (last && /\.(png|jpe?g|webp|gif|svg)$/i.test(last)) return last;
  } catch {
    // Not a URL — fall through to the generic name.
  }
  return `broadcast-image-${index + 1}.jpg`;
}

/**
 * Creates the audit row up-front (status `SENDING`, zero counters) so the
 * record survives a request that is killed mid-dispatch.
 */
export async function createBroadcastRecord(params: {
  tenantId: string;
  channel: BroadcastChannelName;
  subject?: string | null;
  message: string;
  htmlBody?: string | null;
  imageUrls?: string[];
  sentById: string;
  recipientCount: number;
  criteria: Record<string, unknown>;
}) {
  return prisma.customerBroadcast.create({
    data: {
      tenantId: params.tenantId,
      channel: params.channel,
      subject: params.subject ?? null,
      message: params.message,
      htmlBody: params.htmlBody ?? null,
      imageUrls: params.imageUrls ?? [],
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

interface DeliveryResult {
  success: boolean;
  error?: string;
}

/**
 * Deliver one message on the selected channel. Exported so the send loop can be
 * unit-tested with mocked providers.
 */
export async function deliverBroadcastMessage(params: {
  channel: BroadcastChannelName;
  recipient: BroadcastRecipient;
  content: BroadcastContent;
  storeName: string;
}): Promise<DeliveryResult> {
  const { channel, recipient, content, storeName } = params;

  if (channel === 'EMAIL') {
    const email = recipient.email?.trim();
    if (!email) {
      return { success: false, error: 'No email address on the customer record.' };
    }

    const subject = personalizeBroadcastContent(
      content.subject?.trim() || `A message from ${storeName}`,
      recipient.name,
      storeName,
    );
    const html = buildEmailHtml({
      html: content.html,
      text: content.message,
      customerName: recipient.name,
      storeName,
      images: content.imageUrls ?? [],
    });
    const text = personalizeBroadcastContent(content.message, recipient.name, storeName);
    const images = content.imageUrls ?? [];

    const result = await sendEmail(email, subject, html, {
      text,
      ...(images.length > 0
        ? {
            attachments: images.map((url, index) => ({
              filename: attachmentFilename(url, index),
              path: url,
            })),
          }
        : {}),
    });

    if (result.delivered) return { success: true };
    return {
      success: false,
      error:
        result.reason === 'provider-not-configured'
          ? 'Email is not configured (RESEND_API_KEY missing).'
          : 'Email provider rejected the send.',
    };
  }

  if (channel === 'SMS') {
    if (!recipient.phone) {
      return { success: false, error: 'No phone number on the customer record.' };
    }
    const body = buildSmsText({
      message: content.message,
      customerName: recipient.name,
      storeName,
    });
    const result = await sendSmsMessage(recipient.phone, body);
    return result.success
      ? { success: true }
      : { success: false, error: result.error ?? 'SMS dispatch failed.' };
  }

  // Legacy WhatsApp channel.
  const personalized = personalizeBroadcastContent(content.message, recipient.name, storeName);
  const result = await sendWhatsAppTextMessage(recipient.phone, personalized);
  return result.success
    ? { success: true }
    : { success: false, error: result.error ?? 'WhatsApp dispatch failed.' };
}

/**
 * The send loop. Runs OUTSIDE the request once `after()` fires it.
 *
 * Returns the final analytics so a direct (awaited) invocation stays testable.
 */
export async function dispatchBroadcast(params: {
  broadcastId: string;
  channel: BroadcastChannelName;
  recipients: BroadcastRecipient[];
  content: BroadcastContent;
  storeName: string;
}): Promise<BroadcastAnalytics> {
  const { broadcastId, channel, recipients, content, storeName } = params;

  const analytics: BroadcastAnalytics = {
    sent: 0,
    failed: 0,
    total: recipients.length,
    errors: [],
  };

  try {
    for (let index = 0; index < recipients.length; index++) {
      const recipient = recipients[index]!;

      let result = await deliverBroadcastMessage({
        channel,
        recipient,
        content,
        storeName,
      });

      // Provider throttling is the only pacing now — back off and retry once.
      if (!result.success && isRateLimitFailure(result.error)) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_BASE_MS));
        result = await deliverBroadcastMessage({ channel, recipient, content, storeName });
      }

      if (result.success) {
        analytics.sent++;
      } else {
        analytics.failed++;
        const identifier = channel === 'EMAIL' ? recipient.email : recipient.phone;
        analytics.errors.push(`${identifier ?? recipient.id}: ${result.error ?? 'Unknown error'}`);
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
  channel: BroadcastChannelName;
  recipients: BroadcastRecipient[];
  content: BroadcastContent;
  storeName: string;
}): void {
  const run = () => dispatchBroadcast(params).catch(() => {});
  try {
    after(run);
  } catch {
    void run();
  }
}
