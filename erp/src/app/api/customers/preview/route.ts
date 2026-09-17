import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { requirePermissionResponse } from '@/lib/api/permission-guard';
import { ApiError } from '@/lib/api/errors';
import { parseQueryInt, parseQueryNumber } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { Gender, type Prisma } from '@/generated/prisma/client';

// M05-05 (BUG-74 + OBS-51): this endpoint exists to serve the broadcast
// composer, so it now requires the composer's own permission (`broadcast:send`,
// client decision D15) instead of leaking phone numbers + totalSpend to every
// authenticated role, and its filters go through the shared XC-01 parsers so a
// malformed param is a typed 400 rather than a Prisma-driven 500.
const GENDER_VALUES = new Set<string>(Object.values(Gender));

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

    const forbidden = requirePermissionResponse(session.user, PERMISSIONS.BROADCAST.send);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);

    const tagsParam = searchParams.get('tags');
    const gender = searchParams.get('gender');
    // XC-01: 'abc' / '1e999' → 400 naming the param (BUG-74). Numeric but
    // out-of-domain values keep their previous behavior (minSpend=1e20 → 200).
    const minSpend = parseQueryNumber(searchParams, 'minSpend', { min: 0 });
    const maxSpend = parseQueryNumber(searchParams, 'maxSpend', { min: 0 });
    // Parsed (so garbage 400s) but deliberately NOT clamped: an out-of-domain
    // month keeps its historical "ignore the filter" behavior (P2/X4/T2 pins).
    const birthdayMonth = parseQueryInt(searchParams, 'birthdayMonth');

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
      if (!GENDER_VALUES.has(gender)) {
        throw ApiError.validation('Query parameter "gender" must be one of MALE, FEMALE, OTHER');
      }
      where.gender = gender as Gender;
    }

    if (minSpend !== undefined) {
      where.totalSpend = {
        ...(typeof where.totalSpend === 'object' ? where.totalSpend : {}),
        gte: minSpend,
      } as Prisma.DecimalFilter;
    }

    if (maxSpend !== undefined) {
      where.totalSpend = {
        ...(typeof where.totalSpend === 'object' ? where.totalSpend : {}),
        lte: maxSpend,
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

    // Apply birthdayMonth filter in JS (Prisma doesn't support EXTRACT).
    // Out-of-domain months are ignored, matching the pre-fix behavior.
    const filtered =
      birthdayMonth !== undefined && birthdayMonth >= 1 && birthdayMonth <= 12
        ? customers.filter((c) => c.birthday && c.birthday.getMonth() + 1 === birthdayMonth)
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
    // INF-02/XC-01: ApiErrors (incl. the 400s thrown above) map to the typed
    // envelope; unknown errors are logged and returned as a generic 500.
    return toErrorResponse(error, 'GET /api/customers/preview');
  }
}
