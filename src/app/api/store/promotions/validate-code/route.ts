import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { evaluatePromotions } from '@/lib/services/promotion.service';
import { EvaluateCartSchema } from '@/lib/validators/promotion.validators';

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

    const body = await request.json();
    const { code, cartLines, customerId } = body as {
      code?: string;
      cartLines?: Array<{ productId: string; variantId: string; quantity: number; unitPrice: number }>;
      customerId?: string;
    };

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Promo code is required' } },
        { status: 400 },
      );
    }

    const parsed = EvaluateCartSchema.safeParse({
      cartLines: cartLines ?? [],
      customerId,
      promoCode: code.trim(),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error?.issues?.[0]?.message ?? 'Validation failed' } },
        { status: 400 },
      );
    }

    const result = await evaluatePromotions(
      tenantId,
      parsed.data.cartLines,
      parsed.data.customerId,
      parsed.data.promoCode,
    );

    const promoDiscount = result.appliedDiscounts.find(
      (d) => d.promotionType === 'PROMO_CODE',
    );

    if (!promoDiscount) {
      const skippedReason = result.skippedPromotions.find(
        (s) => s.reason.toLowerCase().includes('promo'),
      );
      const message = skippedReason
        ? (skippedReason as { reason: string }).reason
        : 'Promo code not found or expired';
      return NextResponse.json(
        { success: false, error: { code: 'PROMO_INVALID', message } },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, data: promoDiscount });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to validate promo code' } },
      { status: 500 },
    );
  }
}
