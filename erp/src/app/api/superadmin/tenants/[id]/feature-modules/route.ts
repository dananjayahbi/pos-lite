import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FeatureModuleToggleSchema } from '@/lib/validators/appointment.validators';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only super admins can manage feature modules' } },
        { status: 403 },
      );
    }

    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = FeatureModuleToggleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const currentSettings = (tenant.settings ?? {}) as Record<string, unknown>;
    const updatedSettings = {
      ...currentSettings,
      enabledModules: parsed.data.modules,
    };

    await prisma.tenant.update({
      where: { id },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({ success: true, data: { enabledModules: parsed.data.modules } });
  } catch (error) {
    console.error('PATCH /api/superadmin/tenants/[id]/feature-modules error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
