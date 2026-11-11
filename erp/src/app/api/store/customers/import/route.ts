import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import { Gender } from '@/generated/prisma/client';
import {
  CUSTOMER_IMPORT_COLUMNS,
  CustomerCsvRowSchema,
  normalizeSriLankaPhone,
} from '@/lib/validators/customer-import.validators';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 500;

function parseBirthday(value: string | undefined): Date | undefined {
  if (!value || value.trim() === '') return undefined;
  const date = new Date(value.trim());
  if (isNaN(date.getTime())) return undefined;
  return date;
}

function parseTags(value: string | undefined): string[] {
  if (!value || value.trim() === '') return [];
  return value.split(',').map((t) => t.trim()).filter(Boolean);
}

function parseGender(value: string | undefined): Gender | undefined {
  if (!value || value.trim() === '') return undefined;
  const upper = value.trim().toUpperCase();
  if (upper === 'MALE' || upper === 'FEMALE' || upper === 'OTHER') return upper;
  return undefined;
}

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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.createCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('csv');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'No CSV file provided' } },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File size must be under 2MB' } },
        { status: 413 },
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FORMAT', message: 'Only CSV files are accepted' } },
        { status: 415 },
      );
    }

    const csvText = (await file.text()).replace(/^\uFEFF/, '');
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    const fields = (parsed.meta.fields ?? []).map((field) => field.trim());
    const missingHeaders = ['Name', 'Phone'].filter((header) => !fields.includes(header));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_HEADERS',
            message: `CSV is missing required column(s): ${missingHeaders.join(', ')}. Expected columns: ${CUSTOMER_IMPORT_COLUMNS.join(', ')}.`,
          },
        },
        { status: 400 },
      );
    }

    if (parsed.data.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: { code: 'TOO_MANY_ROWS', message: `Maximum ${MAX_ROWS} rows allowed. Found ${parsed.data.length}.` } },
        { status: 422 },
      );
    }

    // Fetch existing phone numbers for duplicate checking
    const existingCustomers = await prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      select: { phone: true },
    });
    const existingPhones = new Set(
      existingCustomers.map((c) => normalizeSriLankaPhone(c.phone)),
    );

    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const toCreate: Array<{
      tenantId: string;
      name: string;
      phone: string;
      phone2: string | null;
      email: string | null;
      address: string | null;
      city: string | null;
      gender: Gender | null;
      birthday: Date | null;
      tags: string[];
      notes: string | null;
    }> = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const rawRow = parsed.data[i];
      const rowNum = i + 2; // +2 for header row + 0-index

      const result = CustomerCsvRowSchema.safeParse(rawRow);
      if (!result.success) {
        const msg = result.error.issues.map((issue) => issue.message).join('; ');
        errors.push({ row: rowNum, message: msg });
        continue;
      }

      const row = result.data;
      const name = row.Name;
      const phone = row.Phone;

      if (existingPhones.has(normalizeSriLankaPhone(phone))) {
        skipped.push(`Row ${rowNum}: ${name} (duplicate phone ${phone})`);
        continue;
      }

      const gender = parseGender(row.Gender);
      const birthday = parseBirthday(row.Birthday);
      const tags = parseTags(row.Tags);
      const email = row.Email && row.Email.trim() !== '' ? row.Email.trim() : null;
      const phone2 = row.Phone2 && row.Phone2.trim() !== '' ? row.Phone2.trim() : null;
      const address = row.Address && row.Address.trim() !== '' ? row.Address.trim() : null;
      const city = row.City && row.City.trim() !== '' ? row.City.trim() : null;
      const notes = row.Notes && row.Notes.trim() !== '' ? row.Notes.trim() : null;

      toCreate.push({
        tenantId,
        name,
        phone,
        phone2,
        email,
        address,
        city,
        gender: gender ?? null,
        birthday: birthday ?? null,
        tags,
        notes,
      });

      existingPhones.add(normalizeSriLankaPhone(phone));
      imported.push(name);
    }

    if (toCreate.length > 0) {
      await prisma.customer.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
        skippedDetails: skipped,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error('POST /api/store/customers/import error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
