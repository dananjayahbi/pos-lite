import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { buildPettyCashExportData } from '@/lib/services/petty-cash.service';
import { toCsv, csvDownloadResponse, type CsvColumn } from '@/lib/export';

const CATEGORY_LABEL: Record<string, string> = {
  RENT: 'Rent',
  SALARIES: 'Salaries',
  UTILITIES: 'Utilities',
  ADVERTISING: 'Advertising',
  MAINTENANCE: 'Maintenance',
  MISCELLANEOUS: 'Miscellaneous',
  OTHER: 'Other',
  STAFF_MEALS: 'Staff Meals',
  TEA_SUGAR: 'Tea & Sugar',
  OFFICE_STATIONERY: 'Office Stationery',
  TRAVEL: 'Travel',
};

export async function GET(request: Request) {
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
    if (!hasPermission(session.user, PERMISSIONS.EXPENSE.viewExpense)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const data = await buildPettyCashExportData(tenantId, {
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      category: searchParams.get('category') ?? undefined,
    });

    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No petty cash fund found' } },
        { status: 404 },
      );
    }

    const statementColumns: CsvColumn<{ label: string; value: string }>[] = [
      { header: 'Item', value: (r) => r.label },
      { header: 'Amount', value: (r) => r.value },
    ];
    const statementRows = [
      { label: 'Opening Balance', value: data.balance.openingBalance.toFixed(2) },
      { label: 'Total Expenses', value: data.balance.totalExpenses.toFixed(2) },
      { label: 'Current Balance', value: data.balance.currentBalance.toFixed(2) },
    ];
    const statementCsv = toCsv(statementColumns, statementRows);

    const expenseColumns: CsvColumn<(typeof data.expenses)[number]>[] = [
      { header: 'Date', value: (r) => r.expenseDate.slice(0, 10) },
      { header: 'Category', value: (r) => CATEGORY_LABEL[r.category] ?? r.category },
      { header: 'Description', value: (r) => r.description },
      { header: 'Amount', value: (r) => r.amount.toFixed(2) },
      { header: 'Receipt URL', value: (r) => r.receiptImageUrl ?? '' },
      { header: 'Recorded By', value: (r) => r.recordedByEmail },
    ];
    const expensesCsv = toCsv(expenseColumns, data.expenses);

    const categoryColumns: CsvColumn<(typeof data.byCategory)[number]>[] = [
      { header: 'Category', value: (r) => CATEGORY_LABEL[r.category] ?? r.category },
      { header: 'Count', value: (r) => r.count },
      { header: 'Total', value: (r) => r.total.toFixed(2) },
    ];
    const categoriesCsv = toCsv(categoryColumns, data.byCategory);

    const sections = [
      `${data.fund.name} - Petty Cash Audit Trail`,
      '',
      'BALANCE STATEMENT',
      statementCsv,
      '',
      'EXPENSES',
      expensesCsv,
      '',
      'CATEGORY TOTALS',
      categoriesCsv,
    ];
    const csv = sections.join('\r\n');

    const filename = `petty-cash-export-${new Date().toISOString().slice(0, 10)}.csv`;
    return csvDownloadResponse(csv, filename);
  } catch (error) {
    console.error('GET /api/store/petty-cash/export error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export petty cash' } },
      { status: 500 },
    );
  }
}
