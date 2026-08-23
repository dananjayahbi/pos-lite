import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { importRemittanceStatement } from '@/lib/services/reconciliation.service';
import { detectStatementFileType } from '@/lib/services/reconciliation-parser.service';

export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.importRemittance);
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return validationError(null, 'Invalid form data');
  }

  const file = form.get('file');
  if (!(file instanceof File) || !file.name) {
    return validationError(null, 'A statement file is required');
  }
  if (detectStatementFileType(file.name) === null) {
    return validationError(null, 'Only .csv, .xlsx, or .xls statement files are accepted');
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const statement = await importRemittanceStatement(guard.tenantId, guard.userId, file.name, buffer);
    return NextResponse.json({ success: true, data: statement });
  } catch (error) {
    console.error('POST /api/store/reconciliation/import error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
