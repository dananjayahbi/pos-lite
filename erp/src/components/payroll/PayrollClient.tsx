'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { CalendarDays, CheckCircle2, FileBarChart, Loader2, Play, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '@/components/shared/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PayrollSettingsCard } from '@/components/payroll/PayrollSettingsCard';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { formatRupee } from '@/lib/format';
import { calculatePayroll } from '@/lib/payroll/calculations';
import type { PayrollPreview, PayrollPreviewRow } from '@/lib/payroll/types';

interface PayrollRunSummary {
  id: string;
  periodMonth: string;
  status: string;
  totalGross: string;
  totalNet: string;
  totalCompanyCost: string;
  generatedAt: string;
  _count: { items: number };
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const RATE_HELP = 'Employee EPF 8% · Employer EPF 12% · Employer ETF 3% (Sri Lankan law)';

export default function PayrollClient({ initialMonth }: { initialMonth?: string | undefined }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canRun = hasPermission(PERMISSIONS.PAYROLL.runPayroll);
  const [month, setMonth] = useState(() =>
    initialMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(initialMonth) ? initialMonth : currentMonth(),
  );
  const [notes, setNotes] = useState('');
  const [overrides, setOverrides] = useState<
    Record<string, { noPayDays?: number; advanceDeduction?: number }>
  >({});

  const previewQuery = useQuery<PayrollPreview>({
    queryKey: ['payroll-preview', month],
    queryFn: async () => {
      const res = await fetch(`/api/store/payroll/preview?month=${encodeURIComponent(month)}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: PayrollPreview;
        error?: { message: string };
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Failed to load payroll preview');
      }
      return json.data;
    },
  });

  const runsQuery = useQuery<PayrollRunSummary[]>({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const res = await fetch('/api/store/payroll/runs?limit=12');
      const json = (await res.json()) as { success: boolean; data?: PayrollRunSummary[] };
      return json.data ?? [];
    },
  });

  const preview = previewQuery.data;

  const rows = useMemo<PayrollPreviewRow[]>(() => {
    if (!preview) return [];
    return preview.rows.map((row) => {
      const override = overrides[row.userId];
      const computed = calculatePayroll({
        basicSalary: row.basicSalary,
        allowances: row.allowances,
        overtimeMinutes: row.overtimeMinutes,
        overtimeMultiplier: preview.overtimeMultiplier,
        workingDays: preview.workingDays,
        commissionAmount: row.commissionAmount,
        noPayDays: override?.noPayDays ?? Number(row.noPayDays),
        advanceDeduction: override?.advanceDeduction ?? Number(row.advanceDeduction),
        employeeEpfRate: preview.rates.employeeEpf,
        employerEpfRate: preview.rates.employerEpf,
        employerEtfRate: preview.rates.employerEtf,
      });
      return { ...row, ...computed };
    });
  }, [overrides, preview]);

  const totals = useMemo(() => {
    const sum = (pick: (row: PayrollPreviewRow) => string) =>
      rows.reduce((acc, row) => acc.add(pick(row)), new Decimal(0)).toFixed(2);
    return {
      gross: sum((row) => row.grossSalary),
      net: sum((row) => row.netSalary),
      companyCost: sum((row) => row.totalCompanyCost),
      employeeEpf: sum((row) => row.employeeEpf),
      employerEpf: sum((row) => row.employerEpf),
      employerEtf: sum((row) => row.employerEtf),
    };
  }, [rows]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          notes: notes.trim() || undefined,
          overrides: rows.map((row) => ({
            userId: row.userId,
            noPayDays: Number(row.noPayDays),
            advanceDeduction: Number(row.advanceDeduction),
          })),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { id: string; periodMonth: string };
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to generate payroll');
      }
      return json.data;
    },
    onSuccess: (data) => {
      toast.success(`Payroll generated for ${data?.periodMonth ?? month}`);
      setNotes('');
      setOverrides({});
      void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to generate payroll');
    },
  });

  function setOverride(userId: string, patch: { noPayDays?: number; advanceDeduction?: number }) {
    setOverrides((previous) => ({
      ...previous,
      [userId]: { ...previous[userId], ...patch },
    }));
  }

  if (previewQuery.isError) {
    return (
      <PageContainer className="space-y-6">
        <h1 className="font-display text-espresso text-2xl font-bold">Run payroll</h1>
        <Card className="border-mist">
          <CardContent className="text-sand-ink py-10 text-center text-sm">
            Could not load payroll preview:{' '}
            {previewQuery.error instanceof Error ? previewQuery.error.message : 'unknown error'}
            <div className="mt-4">
              <Button variant="outline" onClick={() => void previewQuery.refetch()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-espresso text-2xl font-bold">Run payroll</h1>
          <p className="text-sand-ink mt-1 text-sm">
            Generate the monthly salary run from basic salary, allowances, overtime and sales
            commission. {RATE_HELP}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label
              htmlFor="payroll-month"
              className="text-espresso mb-1 block text-xs font-semibold"
            >
              Payroll month
            </Label>
            <Input
              id="payroll-month"
              type="month"
              value={month}
              max={currentMonth()}
              onChange={(event) => {
                if (event.target.value) {
                  setMonth(event.target.value);
                  setOverrides({});
                }
              }}
              className="w-48"
            />
          </div>
          <Button variant="outline" asChild>
            <Link href={`/payroll/reports?month=${month}`}>
              <FileBarChart className="mr-2 h-4 w-4" />
              Reports & bank sheets
            </Link>
          </Button>
        </div>
      </div>

      {preview?.alreadyGenerated && (
        <div className="flex items-start gap-3 rounded-lg border border-[#2D6A4F]/30 bg-[#E8F3ED] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#2D6A4F]" />
          <div className="text-espresso text-sm">
            <p className="font-semibold">Payroll for {preview.label} is already generated.</p>
            <p className="text-sand-ink mt-1">
              View the run, download payslips or export bank/statutory files from{' '}
              <Link href={`/payroll/reports?month=${month}`} className="text-terracotta underline">
                Reports & bank sheets
              </Link>
              . A generated month cannot be regenerated, so issued payslips stay immutable.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="text-terracotta h-4 w-4" />}
          label="Employees"
          value={preview ? String(preview.rows.length) : '—'}
        />
        <StatCard
          icon={<CalendarDays className="text-terracotta h-4 w-4" />}
          label="Gross salary"
          value={preview ? formatRupee(totals.gross) : '—'}
        />
        <StatCard
          icon={<Play className="text-terracotta h-4 w-4" />}
          label="Net payable"
          value={preview ? formatRupee(totals.net) : '—'}
        />
        <StatCard
          icon={<FileBarChart className="text-terracotta h-4 w-4" />}
          label="Total company cost"
          value={preview ? formatRupee(totals.companyCost) : '—'}
        />
      </div>

      {preview && (
        <PayrollSettingsCard
          key={JSON.stringify(preview.settings)}
          initialValues={preview.settings}
          onSaved={() => void previewQuery.refetch()}
        />
      )}

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso text-base">
            {preview ? `${preview.label} payroll preview` : 'Payroll preview'}
          </CardTitle>
          <CardDescription>
            {preview
              ? `${preview.rows.length} active staff · ${preview.workingDays} working days · OT ×${preview.overtimeMultiplier} · Employee EPF ${preview.rates.employeeEpf}% · Employer EPF ${preview.rates.employerEpf}% · ETF ${preview.rates.employerEtf}%`
              : 'Loading live salary, attendance and commission data…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="bg-linen h-11 rounded" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sand-ink py-8 text-center text-sm">
              No active staff members were found for this store.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[190px]">Employee</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="min-w-[92px] text-right">No-pay days</TableHead>
                    <TableHead className="min-w-[110px] text-right">Advance (LKR)</TableHead>
                    <TableHead className="text-right">EPF 8%</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <p className="text-espresso font-medium">{row.staffName}</p>
                        <p className="text-mist-ink text-xs">
                          {row.role}
                          {!row.hasSalaryConfig ? ' · no salary configured' : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupee(row.basicSalary)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupee(row.allowances)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupee(row.overtimeAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupee(row.commissionAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatRupee(row.grossSalary)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={31}
                          step="0.5"
                          value={row.noPayDays}
                          disabled={preview?.alreadyGenerated || !canRun}
                          onChange={(event) =>
                            setOverride(row.userId, {
                              noPayDays: Math.max(0, Number(event.target.value) || 0),
                            })
                          }
                          className="ml-auto h-8 w-20 text-right font-mono text-xs"
                          aria-label={`No-pay days for ${row.staffName}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.advanceDeduction}
                          disabled={preview?.alreadyGenerated || !canRun}
                          onChange={(event) =>
                            setOverride(row.userId, {
                              advanceDeduction: Math.max(0, Number(event.target.value) || 0),
                            })
                          }
                          className="ml-auto h-8 w-24 text-right font-mono text-xs"
                          aria-label={`Salary advance for ${row.staffName}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-[#9B2226]">
                        {formatRupee(row.employeeEpf)}
                      </TableCell>
                      <TableCell className="text-espresso text-right font-mono text-sm font-bold">
                        {formatRupee(row.netSalary)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {preview && !preview.alreadyGenerated && canRun && rows.length > 0 && (
            <div className="border-mist mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-md">
                <Label
                  htmlFor="payroll-notes"
                  className="text-espresso mb-1 block text-xs font-semibold"
                >
                  Notes (optional)
                </Label>
                <Input
                  id="payroll-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="e.g. November salary run"
                  maxLength={500}
                  disabled={generateMutation.isPending}
                />
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-espresso text-pearl hover:bg-espresso/90"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Generate payroll — {formatRupee(totals.net)} net
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-espresso text-base">
            Recent payroll runs
          </CardTitle>
          <CardDescription>
            Generated months are immutable snapshots used by payslips and exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading ? (
            <Skeleton className="bg-linen h-24 rounded" />
          ) : (runsQuery.data ?? []).length === 0 ? (
            <p className="text-sand-ink py-6 text-center text-sm">
              No payroll has been generated yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Company cost</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runsQuery.data ?? []).map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs">{run.periodMonth}</TableCell>
                      <TableCell className="text-xs">{run.status}</TableCell>
                      <TableCell className="text-right text-xs">{run._count.items}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupee(run.totalGross)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupee(run.totalNet)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupee(run.totalCompanyCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/payroll/reports?month=${run.periodMonth}`}
                          className="text-terracotta text-xs underline"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-mist">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-linen rounded-lg p-2">{icon}</div>
        <div>
          <p className="text-mist-ink text-xs tracking-wide uppercase">{label}</p>
          <p className="text-espresso font-mono text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
