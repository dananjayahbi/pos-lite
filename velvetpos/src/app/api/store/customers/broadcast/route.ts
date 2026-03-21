import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';

const BroadcastSchema = z.object({
  message: z.string().min(1).max(1000),
  filters: z.object({
    tag: z.string().optional(),
    spendMin: z.number().min(0).optional(),
    birthdayMonth: z.int().min(1).max(12).optional(),
  }).optional(),
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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.createCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = BroadcastSchema.safeParse(body);

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

    // Build query conditions
    const where: Record<string, unknown> = {
      tenantId,
      isActive: true,
      deletedAt: null,
      phone: { not: '' },
    };

    if (filters?.tag) {
      where.tags = { has: filters.tag };
    }
    if (filters?.spendMin !== undefined) {
      where.totalSpend = { gte: filters.spendMin };
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

    if (customers.length > 200) {
      return NextResponse.json(
        { success: false, error: { code: 'LIMIT_EXCEEDED', message: `Too many recipients (${customers.length}). Maximum is 200.` } },
        { status: 422 },
      );
    }

    // Create broadcast record
    const broadcast = await prisma.customerBroadcast.create({
      data: {
        tenantId,
        message,
        recipientCount: 0,
        sentById: session.user.id,
        filters: filters ?? {},
      },
    });

    // Send messages
    let successCount = 0;
    for (const customer of customers) {
      const firstName = customer.name.split(' ')[0] ?? '';
      const personalizedMessage = message.replaceAll('[name]', firstName);
      const result = await sendWhatsAppTextMessage(customer.phone, personalizedMessage);
      if (result.success) successCount++;
    }

    // Update recipient count
    await prisma.customerBroadcast.update({
      where: { id: broadcast.id },
      data: { recipientCount: successCount },
    });

    return NextResponse.json(
      { success: true, data: { broadcastId: broadcast.id, recipientCount: successCount } },
      { status: 202 },
    );
  } catch (error) {
    console.error('POST /api/store/customers/broadcast error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
