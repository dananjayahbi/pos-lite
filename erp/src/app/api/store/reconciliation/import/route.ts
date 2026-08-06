import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { importRemittanceStatement } from '@/lib/services/reconciliation.service';

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
    return validationError(null, 'A CSV file is required');
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return validationError(null, 'Only CSV files are accepted');
  }

  try {
    const csv = await file.text();
    const statement = await importRemittanceStatement(guard.tenantId, guard.userId, file.name, csv);
    return NextResponse.json({ success: true, data: statement });
  } catch (error) {
    console.error('POST /api/store/reconciliation/import error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
