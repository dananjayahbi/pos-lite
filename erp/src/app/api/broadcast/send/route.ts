import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { getProviderConfigStatus } from '@/lib/notifications/provider-status';
import { BroadcastSendSchema } from '@/lib/validators/broadcast.validators';
import { fetchBroadcastAudience } from '@/lib/services/broadcast.service';
import {
  BROADCAST_ERROR_SAMPLE_LIMIT,
  createBroadcastRecord,
  scheduleBroadcastDispatch,
  type BroadcastContent,
} from '@/lib/services/broadcast-dispatch.service';

/**
 * POST /api/broadcast/send — create an Email or SMS marketing broadcast.
 *
 * The audit row is written first and the send loop runs after the response
 * (same M31-03 contract as the legacy WhatsApp route). Responds `202` with the
 * queued recipient count.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.BROADCAST.send);
    if (forbidden) return forbidden;

    const body = await request.json().catch(() => null);
    const parsed = BroadcastSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Validation failed',
            details: parsed.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const { channel, subject, message, html, imageUrls, filters } = parsed.data;

    const audience = await fetchBroadcastAudience(tenantId, channel, filters ?? {});
    if (audience.total === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_RECIPIENTS',
            message:
              channel === 'EMAIL'
                ? 'No customers with an email address match these filters'
                : 'No customers with a phone number match these filters',
          },
        },
        { status: 422 },
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const storeName = tenant?.name ?? '';

    const bodyText = (message ?? '').trim();
    const htmlBody = html?.trim() ? html : null;
    const images = imageUrls ?? [];

    const broadcast = await createBroadcastRecord({
      tenantId,
      channel,
      subject: channel === 'EMAIL' ? (subject ?? null) : null,
      message: bodyText,
      htmlBody: channel === 'EMAIL' ? htmlBody : null,
      imageUrls: channel === 'EMAIL' ? images : [],
      sentById: session.user.id,
      recipientCount: audience.total,
      criteria: {
        ...(filters ?? {}),
        channel,
        ...(channel === 'EMAIL' && subject ? { subject } : {}),
      },
    });

    const content: BroadcastContent = {
      channel,
      subject: subject ?? null,
      message: bodyText,
      html: htmlBody,
      imageUrls: images,
    };

    scheduleBroadcastDispatch({
      broadcastId: broadcast.id,
      channel,
      recipients: audience.recipients,
      content,
      storeName,
    });

    const providerStatus = getProviderConfigStatus();
    const providerConfigured =
      channel === 'EMAIL' ? providerStatus.email : channel === 'SMS' ? providerStatus.sms : providerStatus.whatsapp;

    return NextResponse.json(
      {
        success: true,
        data: {
          broadcastId: broadcast.id,
          channel,
          status: 'SENDING',
          sent: 0,
          failed: 0,
          total: audience.total,
          errors: [] as string[],
          errorSampleLimit: BROADCAST_ERROR_SAMPLE_LIMIT,
          providerConfigured,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    return toErrorResponse(error, 'POST /api/broadcast/send');
  }
}
