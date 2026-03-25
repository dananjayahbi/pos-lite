import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma, Gender } from '@/generated/prisma/client';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);

    const tagsParam = searchParams.get('tags');
    const gender = searchParams.get('gender');
    const minSpend = searchParams.get('minSpend');
    const maxSpend = searchParams.get('maxSpend');
    const birthdayMonth = searchParams.get('birthdayMonth');

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
      isActive: true,
    };

    if (tagsParam) {
      const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        where.tags = { hasSome: tags };
      }
    }

    if (gender && gender !== 'ALL') {
      where.gender = gender as Gender;
    }

    if (minSpend) {
      where.totalSpend = {
        ...(typeof where.totalSpend === 'object' ? where.totalSpend : {}),
        gte: parseFloat(minSpend),
      } as Prisma.DecimalFilter;
    }

    if (maxSpend) {
      where.totalSpend = {
        ...(typeof where.totalSpend === 'object' ? where.totalSpend : {}),
        lte: parseFloat(maxSpend),
      } as Prisma.DecimalFilter;
    }

    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        tags: true,
        totalSpend: true,
        birthday: true,
        gender: true,
      },
      orderBy: { name: 'asc' },
    });

    // Apply birthdayMonth filter in JS (Prisma doesn't support EXTRACT)
    const filtered = birthdayMonth
      ? (() => {
          const month = parseInt(birthdayMonth, 10);
          if (month >= 1 && month <= 12) {
            return customers.filter((c) => {
              if (!c.birthday) return false;
              return c.birthday.getMonth() + 1 === month;
            });
          }
          return customers;
        })()
      : customers;

    return NextResponse.json({
      success: true,
      data: filtered.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        tags: c.tags,
        totalSpend: c.totalSpend.toString(),
        gender: c.gender,
      })),
    });
  } catch (error) {
    console.error('GET /api/customers/preview error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
