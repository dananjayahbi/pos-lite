import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateWebhookSecret } from '@/lib/webhooks/generate-secret';

const ALLOWED_ROLES_READ = new Set(['OWNER', 'MANAGER']);

const KNOWN_EVENTS = [
  'sale.completed',
  'return.initiated',
  'stock.adjusted',
  'stock.low',
  'customer.created',
] as const;

const createEndpointSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith('https://'), {
    message: 'Webhook URL must use HTTPS',
  }),
  events: z
    .array(z.enum(KNOWN_EVENTS))
    .min(1, 'At least one event is required'),
});

export async function GET() {
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

    if (!ALLOWED_ROLES_READ.has(session.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId },
      select: {
        id: true,
        url: true,
        isActive: true,
        events: true,
        createdAt: true,
        deliveries: {
          orderBy: { attemptedAt: 'desc' },
          take: 1,
          select: {
            status: true,
            statusCode: true,
            attemptedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = endpoints.map((ep) => ({
      id: ep.id,
      url: ep.url,
      isActive: ep.isActive,
      events: ep.events,
      createdAt: ep.createdAt,
      lastDelivery: ep.deliveries[0] ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/webhooks/endpoints error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhook endpoints' } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    if (session.user.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only owners can create webhook endpoints' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = createEndpointSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const secret = generateWebhookSecret();

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url: parsed.data.url,
        secret,
        events: parsed.data.events,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: endpoint.id,
          url: endpoint.url,
          secret: endpoint.secret,
          isActive: endpoint.isActive,
          events: endpoint.events,
          createdAt: endpoint.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/webhooks/endpoints error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook endpoint' } },
      { status: 500 },
    );
  }
}
