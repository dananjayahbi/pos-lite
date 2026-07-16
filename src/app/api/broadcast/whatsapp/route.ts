import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';
import type { Prisma, Gender } from '@/generated/prisma/client';

// NOTE: Serverless functions have a timeout (typically 10-60s depending on
// the platform/plan). For large recipient lists, consider offloading to a
// background job queue (e.g. Inngest, QStash) instead of sequential sends.

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

const RESTRICTED_ROLES = ['CASHIER', 'STOCK_CLERK'] as const;

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

    if (RESTRICTED_ROLES.includes(session.user.role as (typeof RESTRICTED_ROLES)[number])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions to send broadcasts' } },
        { status: 403 },
      );
    }

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

    // Send messages sequentially with 1s delay
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const customer of customers) {
      const firstName = customer.name.split(' ')[0] ?? '';
      const personalizedMessage = message
        .replaceAll('{{name}}', firstName)
        .replaceAll('{{storeName}}', storeName);

      const result = await sendWhatsAppTextMessage(customer.phone, personalizedMessage);

      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push(`${customer.phone}: ${result.error ?? 'Unknown error'}`);
      }

      // 1s delay between sends to avoid rate limiting
      if (customers.indexOf(customer) < customers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Record broadcast
    await prisma.customerBroadcast.create({
      data: {
        tenantId,
        message,
        recipientCount: customers.length,
        sentById: session.user.id,
        filters: {
          criteria: filters ?? {},
          analytics: {
            sent,
            failed,
            total: customers.length,
            errors: errors.slice(0, 10),
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { sent, failed, total: customers.length, errors: errors.slice(0, 10) },
    });
  } catch (error) {
    console.error('POST /api/broadcast/whatsapp error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
