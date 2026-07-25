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
    const parsed = EvaluateCartSchema.safeParse(body);
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

    return NextResponse.json({ success: true, data: result }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to evaluate promotions' } },
      { status: 500 },
    );
  }
}
