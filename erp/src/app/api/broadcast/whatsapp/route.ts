import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import {
  BROADCAST_ERROR_SAMPLE_LIMIT,
  createBroadcastRecord,
  scheduleBroadcastDispatch,
  type BroadcastRecipient,
} from '@/lib/services/broadcast-dispatch.service';
import type { Prisma, Gender } from '@/generated/prisma/client';

// M31-03 (OBS-53): the send loop no longer runs inside this request. The audit
// row is created first (status SENDING) and dispatch continues *after* the
// response via Next's `after()`, so a large audience can no longer time out the
// request and destroy the broadcast record. The full rationale lives in
// `src/lib/services/broadcast-dispatch.service.ts`.

const BroadcastBodySchema = z.object({
  filters: z.object({
    tags: z.string().optional(),
    gender: z.string().optional(),
    minSpend: z.number().min(0).optional(),
    maxSpend: z.number().min(0).optional(),
    birthdayMonth: z.number().int().min(1).max(12).optional(),
  }).optional(),
  message: z.string().min(1).max(500),
});

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

    // M31-02 (OBS-51 / decision D15): the broadcast composer's own permission
    // gates the send. The audience preview/count endpoints use the same key so
    // the data needed to send is not readable by roles that cannot send.
    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.BROADCAST.send);
    if (forbidden) return forbidden;

    const body = await request.json();
    const parsed = BroadcastBodySchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const { message, filters } = parsed.data;

    // Build where clause (same logic as count endpoint)
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
      isActive: true,
      phone: { not: '' },
    };

    if (filters?.tags) {
      const tags = filters.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        where.tags = { hasSome: tags };
      }
    }

    if (filters?.gender && filters.gender !== 'ALL') {
      where.gender = filters.gender as Gender;
    }

    if (filters?.minSpend !== undefined) {
      where.totalSpend = {
        ...(typeof where.totalSpend === 'object' ? where.totalSpend : {}),
        gte: filters.minSpend,
      } as Prisma.DecimalFilter;
    }

    if (filters?.maxSpend !== undefined) {
      where.totalSpend = {
        ...(typeof where.totalSpend === 'object' ? where.totalSpend : {}),
        lte: filters.maxSpend,
      } as Prisma.DecimalFilter;
    }

    // Fetch matching customers
    let customers = await prisma.customer.findMany({
      where,
      select: { id: true, name: true, phone: true, birthday: true },
    });

    // Apply birthday month filter in JS (Prisma doesn't support EXTRACT)
    if (filters?.birthdayMonth !== undefined) {
      const targetMonth = filters.birthdayMonth;
      customers = customers.filter((c) => {
        if (!c.birthday) return false;
        return c.birthday.getMonth() + 1 === targetMonth;
      });
    }

    // Fetch tenant name for {{storeName}} replacement
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const storeName = tenant?.name ?? '';

    // RECORD FIRST — the audit row exists before a single message is sent, so
    // an interrupted dispatch can no longer destroy the broadcast record.
    const broadcast = await createBroadcastRecord({
      tenantId,
      message,
      sentById: session.user.id,
      recipientCount: customers.length,
      criteria: (filters ?? {}) as Record<string, unknown>,
    });

    const recipients: BroadcastRecipient[] = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
    }));

    // SEND AFTER THE RESPONSE — answer immediately, dispatch in the background.
    scheduleBroadcastDispatch({
      broadcastId: broadcast.id,
      recipients,
      message,
      storeName,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          broadcastId: broadcast.id,
          status: 'SENDING',
          sent: 0,
          failed: 0,
          total: customers.length,
          errors: [] as string[],
          errorSampleLimit: BROADCAST_ERROR_SAMPLE_LIMIT,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('POST /api/broadcast/whatsapp error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
