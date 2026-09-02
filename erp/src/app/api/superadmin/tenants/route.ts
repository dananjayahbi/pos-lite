import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { TenantStatus } from '@/generated/prisma/client';

const createTenantSchema = z.object({
  storeName: z.string().min(2).max(80),
  slug: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  timezone: z.string().min(1),
  currency: z.string().min(1),
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

  const where = {
    deletedAt: null,
    ...(search && {
      name: { contains: search, mode: 'insensitive' as const },
    }),
    ...(status && { status: status as TenantStatus }),
  };

  const businesses = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ businesses, total: businesses.length });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || session.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if 2 businesses already exist
  const existingCount = await prisma.tenant.count({ where: { deletedAt: null } });
  if (existingCount >= 2) {
    return NextResponse.json(
      { error: 'Maximum of 2 businesses allowed. Cannot create more.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = createTenantSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { storeName, slug, ownerEmail, ownerPassword, timezone, currency } = parsed.data;

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

    const tenant = await prisma.tenant.create({
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
          enabledModules: ['appointments', 'delivery'],
        },
      },
    });

    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: ownerEmail,
        passwordHash,
        role: 'OWNER',
      },
    });

    return NextResponse.json({ id: tenant.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
}
