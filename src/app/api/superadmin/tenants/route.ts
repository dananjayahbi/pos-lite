import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createTrialSubscription } from '@/lib/billing/subscription.service';
import type { TenantStatus } from '@/generated/prisma/client';

const createTenantSchema = z.object({
  storeName: z.string().min(2).max(80),
  slug: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  planId: z.string().min(1),
});

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const where = {
    deletedAt: null,
    ...(search && {
      name: { contains: search, mode: 'insensitive' as const },
    }),
    ...(status && { status: status as TenantStatus }),
  };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        subscriptions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tenant.count({ where }),
  ]);

  return NextResponse.json({ tenants, total, page, pageSize: PAGE_SIZE });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createTenantSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { storeName, slug, ownerEmail, ownerPassword, timezone, currency, planId } =
    parsed.data;

  try {
    const existingTenant = await prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
    });

    if (existingTenant) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: ownerEmail, deletedAt: null },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 12);

    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug,
          status: 'ACTIVE',
          settings: {
            currency,
            timezone,
            vatRate: 0,
            ssclRate: 0,
            receiptFooter: '',
          },
        },
      });

      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: ownerEmail,
          passwordHash,
          role: 'OWNER',
        },
      });

      await createTrialSubscription(newTenant.id, planId, tx);

      return newTenant;
    });

    return NextResponse.json({ id: tenant.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
  }
}
