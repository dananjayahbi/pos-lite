import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { z } from 'zod';
import { createCommissionPayout } from '@/lib/services/commission.service';
import { toErrorResponse } from '@/lib/api/error-envelope';

// M20-02: bounds tightened — cuid ids, real entity ids (not ''), and a period
// window that cannot invert. `paymentMethod`/`proofReference`/`notes` get sane
// length ceilings so a caller can't stuff unbounded text into the audit trail.
const PayoutSchema = z
  .object({
    userId: z.string().cuid('userId must be a valid id'),
    periodStart: z.string().datetime({ message: 'periodStart must be an ISO date' }),
    periodEnd: z.string().datetime({ message: 'periodEnd must be an ISO date' }),
    notes: z.string().max(500).optional(),
    paymentMethod: z.string().max(50).optional(),
    proofReference: z.string().max(100).optional(),
  })
  .refine((d) => new Date(d.periodEnd).getTime() >= new Date(d.periodStart).getTime(), {
    path: ['periodEnd'],
    message: 'periodEnd must not be before periodStart',
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

    // M20-01 (XC-03): payouts gate on the staff-management permission rather
    // than a hard-coded role list, so role drift can't silently widen access.
    if (!hasPermission(session.user, PERMISSIONS.STAFF.manageStaff)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only managers and owners can create payouts' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = PayoutSchema.safeParse(body);
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

    const payout = await createCommissionPayout({
      tenantId,
      userId: parsed.data.userId,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      authorizedById: session.user.id,
      authorizedByRole: session.user.role,
      ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      ...(parsed.data.paymentMethod !== undefined && { paymentMethod: parsed.data.paymentMethod }),
      ...(parsed.data.proofReference !== undefined && { proofReference: parsed.data.proofReference }),
    });

    return NextResponse.json({ success: true, data: payout }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    // M20-02: a foreign or unknown staff member is a NOT_FOUND, and a replay of
    // an already-settled period is a typed 409 — neither should be a 500.
    if (message.includes('No unpaid commission records found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_UNPAID_COMMISSIONS', message } },
        { status: 409 },
      );
    }

    return toErrorResponse(error, 'POST /api/store/staff/commissions/payout');
  }
}
