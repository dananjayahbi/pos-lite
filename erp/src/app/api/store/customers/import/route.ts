import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import { z } from 'zod';
import { Gender } from '@/generated/prisma/client';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 500;

const CsvRowSchema = z.object({
  Name: z.string().trim().min(1, 'Name is required').max(100),
  Phone: z.string().trim().max(20).optional().default(''),
  Email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  Gender: z.string().trim().toUpperCase().pipe(z.enum(['MALE', 'FEMALE', 'OTHER'])).optional().or(z.literal('')),
  Birthday: z.string().trim().optional().or(z.literal('')),
  Tags: z.string().trim().optional().or(z.literal('')),
  Notes: z.string().trim().max(500).optional().or(z.literal('')),
});

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

    const csvText = await file.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

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
    const existingPhones = new Set(existingCustomers.map((c) => c.phone));

    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const toCreate: Array<{
      tenantId: string;
      name: string;
      phone: string;
      email: string | null;
      gender: Gender | null;
      birthday: Date | null;
      tags: string[];
      notes: string | null;
    }> = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const rawRow = parsed.data[i];
      const rowNum = i + 2; // +2 for header row + 0-index

      const result = CsvRowSchema.safeParse(rawRow);
      if (!result.success) {
        const msg = result.error.issues.map((issue) => issue.message).join('; ');
        errors.push({ row: rowNum, message: msg });
        continue;
      }

      const row = result.data;
      const name = row.Name;
      const phone = (row.Phone ?? '').trim();

      if (phone && existingPhones.has(phone)) {
        skipped.push(`Row ${rowNum}: ${name} (duplicate phone ${phone})`);
        continue;
      }

      const gender = parseGender(row.Gender);
      const birthday = parseBirthday(row.Birthday);
      const tags = parseTags(row.Tags);
      const email = row.Email && row.Email.trim() !== '' ? row.Email.trim() : null;
      const notes = row.Notes && row.Notes.trim() !== '' ? row.Notes.trim() : null;

      toCreate.push({
        tenantId,
        name,
        phone: phone || '',
        email,
        gender: gender ?? null,
        birthday: birthday ?? null,
        tags,
        notes,
      });

      if (phone) existingPhones.add(phone);
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
