import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, mapDeliveryError, internalError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { detectStatementFileType } from '@/lib/services/reconciliation-parser.service';
import { getDeliveryComparisonReport } from '@/lib/services/reconciliation-compare.service';
import { DeliveryComparisonRangeSchema } from '@/lib/validators/reconciliation.validators';

/** Couriers export a month in well under this; anything larger is a mistake. */
const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

/**
 * Dry-run comparison of our deliveries against a courier statement.
 *
 * This never writes to the reconciliation ledger; use the import endpoint to
 * settle once the differences have been reviewed.
 */
export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewReconciliation);
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return validationError(null, 'Invalid form data');
  }

  const defaults = currentMonthRange();
  const from = String(form.get('from') ?? defaults.from);
  const to = String(form.get('to') ?? defaults.to);
  const range = DeliveryComparisonRangeSchema.safeParse({ from, to });
  if (!range.success) {
    return validationError(range.error.issues, 'Invalid date range');
  }

  const file = form.get('file');
  if (!(file instanceof File) || !file.name) {
    return validationError(null, 'A statement file is required');
  }
  if (detectStatementFileType(file.name) === null) {
    return validationError(null, 'Only .csv, .xlsx, or .xls statement files are accepted');
  }
  if (file.size > MAX_STATEMENT_BYTES) {
    return validationError(null, 'The statement file is too large (max 8 MB)');
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const report = await getDeliveryComparisonReport(
      guard.tenantId,
      file.name,
      buffer,
      range.data.from,
      range.data.to,
    );
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
