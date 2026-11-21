import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getLabelTemplateBundle,
  getLabelTemplateHistory,
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
    const [bundle, history] = await Promise.all([
      getLabelTemplateBundle(guard.tenantId),
      getLabelTemplateHistory(guard.tenantId),
    ]);
    return NextResponse.json({
      success: true,
      data: bundle.template,
      // The client needs the tenant identity to fill an empty sender even
      // before anything is saved (ARGUS #298).
      meta: {
        branding: bundle.branding,
        saved: bundle.saved,
        templateMeta: bundle.meta,
        // ARGUS #306: reviewable before/after change trail.
        history,
      },
    });
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
    // ARGUS #306: capture the sender values that are being replaced, not just
    // the fact that an update happened.
    const before = await getLabelTemplateBundle(guard.tenantId);
    const template = await saveLabelTemplate(guard.tenantId, parsed.data, {
      id: guard.userId,
      email: guard.email,
      role: guard.role,
    });
    await createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: guard.role,
      entityType: 'LabelTemplate',
      entityId: guard.tenantId,
      action: AUDIT_ACTIONS.LABEL_TEMPLATE_UPDATED,
      before: {
        brandName: before.template.brandName,
        fromContact: before.template.fromContact,
        pickupAddress: before.template.pickupAddress ?? '',
      },
      after: {
        brandName: template.brandName,
        fromContact: template.fromContact,
        pickupAddress: template.pickupAddress ?? '',
      },
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
    const before = await getLabelTemplateBundle(guard.tenantId);
    const template = await resetLabelTemplate(guard.tenantId, {
      id: guard.userId,
      email: guard.email,
      role: guard.role,
    });
    await createAuditLog({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorRole: guard.role,
      entityType: 'LabelTemplate',
      entityId: guard.tenantId,
      action: AUDIT_ACTIONS.LABEL_TEMPLATE_UPDATED,
      before: {
        brandName: before.template.brandName,
        fromContact: before.template.fromContact,
        pickupAddress: before.template.pickupAddress ?? '',
      },
      // A reset removes the saved override; the Store Profile sender remains.
      after: null,
    });
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('POST /api/store/delivery/label error:', error);
    return internalError('An unexpected error occurred');
  }
}
