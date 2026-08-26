/**
 * GET /api/public/site/[tenantSlug]/shop-filters
 *
 * Returns the curated set of filter options for the storefront shop panel:
 *   - concerns: the HealthConcern taxonomy (value + display label)
 *   - forms:    the distinct non-null variant `form` values in the catalog
 *
 * The storefront uses this to render the health-concern and product-form
 * filter controls from the actual catalog rather than hardcoded lists.
 * Caches for 60s on the edge.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { HealthConcern } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  errorWithCors,
  handleCorsPreflight,
  jsonWithCors,
} from '@/lib/api/cors';

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

const CONCERN_LABELS: Record<HealthConcern, string> = {
  JOINT_PAIN: 'Joint Pain',
  SKIN_CARE: 'Skin Care',
  DIGESTIVE_HEALTH: 'Digestive Health',
  STRESS_RELIEF: 'Stress Relief',
  IMMUNITY: 'Immunity',
  HAIR_CARE: 'Hair Care',
  RESPIRATORY: 'Respiratory',
  CARDIOVASCULAR: 'Cardiovascular',
  WOMENS_HEALTH: "Women's Health",
  MENS_HEALTH: "Men's Health",
  CHILD_HEALTH: 'Child Health',
  SLEEP_SUPPORT: 'Sleep Support',
  ENERGY_VITALITY: 'Energy & Vitality',
  DIABETES_SUPPORT: 'Diabetes Support',
  LIVER_KIDNEY_HEALTH: 'Liver & Kidney Health',
  WEIGHT_MANAGEMENT: 'Weight Management',
  ORAL_CARE: 'Oral Care',
  EYE_HEALTH: 'Eye Health',
};

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return handleCorsPreflight(request);
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { tenantSlug } = await context.params;

  if (!tenantSlug || tenantSlug.length > 64) {
    return errorWithCors(request, 400, 'Invalid tenant slug');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!tenant) {
    return errorWithCors(request, 404, 'Tenant not found');
  }

  if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
    return errorWithCors(request, 403, 'Storefront unavailable');
  }

  // Curated concern taxonomy (all enum values, enumerated order).
  const concerns = (Object.values(HealthConcern) as HealthConcern[]).map(
    (value) => ({ value, label: CONCERN_LABELS[value] ?? value }),
  );

  // Distinct non-null forms from live variants, excluding archived products.
  const formRows = await prisma.productVariant.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      form: { not: null },
      product: { isArchived: false, deletedAt: null },
    },
    select: { form: true },
    distinct: ['form'],
    orderBy: { form: 'asc' },
  });

  const forms = formRows
    .map((r) => r.form)
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0);

  return jsonWithCors(
    request,
    { concerns, forms },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
