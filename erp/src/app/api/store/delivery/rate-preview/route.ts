import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { calculateShippingFee } from '@/lib/services/rate-engine.service';
import { z } from 'zod';

const RatePreviewSchema = z.object({
  weightKg: z.coerce.number().nonnegative().optional(),
  destinationDistrictId: z.coerce.number().int().optional(),
  destinationCityId: z.coerce.number().int().optional(),
});

export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.createDelivery);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = RatePreviewSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const result = await calculateShippingFee({
      tenantId: guard.tenantId,
      weightKg: parsed.data.weightKg,
      destinationDistrictId: parsed.data.destinationDistrictId,
      destinationCityId: parsed.data.destinationCityId,
    });
    return NextResponse.json({
      success: true,
      data: {
        shippingFee: result.shippingFee.toFixed(2),
        baseRate: result.baseRate.toFixed(2),
        extraKgRate: result.extraKgRate.toFixed(2),
        freeBaseWeightKg: result.freeBaseWeightKg.toFixed(2),
      },
    });
  } catch (error) {
    console.error('POST /api/store/delivery/rate-preview error:', error);
    return internalError('An unexpected error occurred');
  }
}
