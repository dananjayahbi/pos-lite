import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getLabelTemplate,
  saveLabelTemplate,
  resetLabelTemplate,
} from '@/lib/services/label.service';
import { LabelTemplateSchema } from '@/lib/validators/label.validators';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

export async function GET() {
  // Reading the template is needed by anyone who prints labels (e.g. dispatch
  // staff), so it only requires delivery view access.
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewDelivery);
  if (!guard.ok) return guard.response;

  try {
    const template = await getLabelTemplate(guard.tenantId);
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('GET /api/store/delivery/label error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function PUT(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageLabelTemplate);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = LabelTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const template = await saveLabelTemplate(guard.tenantId, parsed.data);
    void createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: 'UNKNOWN',
      entityType: 'LabelTemplate',
      entityId: guard.tenantId,
      action: AUDIT_ACTIONS.LABEL_TEMPLATE_UPDATED,
    });
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('PUT /api/store/delivery/label error:', error);
    return internalError('An unexpected error occurred');
  }
}

export async function POST() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageLabelTemplate);
  if (!guard.ok) return guard.response;

  try {
    const template = await resetLabelTemplate(guard.tenantId);
    void createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: 'UNKNOWN',
      entityType: 'LabelTemplate',
      entityId: guard.tenantId,
      action: AUDIT_ACTIONS.LABEL_TEMPLATE_UPDATED,
    });
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('POST /api/store/delivery/label error:', error);
    return internalError('An unexpected error occurred');
  }
}
