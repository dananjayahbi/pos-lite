'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { CalendarDays, CheckCircle2, FileBarChart, Loader2, Play, RotateCcw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '@/components/shared/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { fetchPayrollEnvelope, resolvePayrollLoadState } from '@/lib/payroll/api-load-state';
import { assessPayrollRunReadiness, listStaffNames } from '@/lib/payroll/run-readiness';
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
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [confirmAttendance, setConfirmAttendance] = useState(false);

  const previewQuery = useQuery<PayrollPreview>({
    queryKey: ['payroll-preview', month],
    queryFn: () =>
      fetchPayrollEnvelope<PayrollPreview>(
        `/api/store/payroll/preview?month=${encodeURIComponent(month)}`,
      ),
  });

  const runsQuery = useQuery<PayrollRunSummary[]>({
    queryKey: ['payroll-runs'],
    queryFn: () =>
      fetchPayrollEnvelope<PayrollRunSummary[]>('/api/store/payroll/runs?limit=12'),
  });

  const [payRun, setPayRun] = useState<PayrollRunSummary | null>(null);
  const [payAccountId, setPayAccountId] = useState('');
  const [voidRun, setVoidRun] = useState<PayrollRunSummary | null>(null);

  const accountsQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ['payroll-payment-accounts'],
    enabled: canRun,
    queryFn: async () => {
      const accounts = await fetchPayrollEnvelope<{ id: string; name: string }[]>(
        '/api/store/payment-accounts?status=ACTIVE',
      );
      return accounts.filter((account) => !('pettyCashFund' in account));
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

  // ARGUS #375: zero/unsalaried runs need an explicit acknowledgement; no
  // staff is a hard refusal on the server and here.
  const readiness = useMemo(() => assessPayrollRunReadiness(rows), [rows]);

  // ARGUS #377: a failed list request is an error, never "no payroll yet".
  const runsState = resolvePayrollLoadState({
    isLoading: runsQuery.isLoading,
    isError: runsQuery.isError,
    hasData: (runsQuery.data?.length ?? 0) > 0,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          notes: notes.trim() || undefined,
          confirmZeroPayRun: readiness.requiresConfirmation ? confirmWarnings : undefined,
          confirmIncompleteAttendance: preview?.attendanceSummary.requiresConfirmation
            ? confirmAttendance
            : undefined,
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
      setConfirmWarnings(false);
      setConfirmAttendance(false);
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

  // ARGUS #375: remove an unpaid run so the month can be generated again.
  const voidMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/store/payroll/runs/${runId}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to void payroll run');
      }
      return json;
    },
    onSuccess: () => {
      toast.success('Payroll run voided; the month can be generated again');
      setVoidRun(null);
      void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to void payroll run');
    },
  });

  // ARGUS #372: settle the run only when salary is actually paid.
  const markPaidMutation = useMutation({
    mutationFn: async (input: { runId: string; paymentAccountId: string }) => {
      const res = await fetch(`/api/store/payroll/runs/${input.runId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentAccountId: input.paymentAccountId }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message: string } };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to mark payroll paid');
      }
      return json;
    },
    onSuccess: () => {
      toast.success('Payroll marked paid; salary and commission posted');
      setPayRun(null);
      setPayAccountId('');
      void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['payment-accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to mark payroll paid');
    },
  });

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
                  setConfirmWarnings(false);
                  setConfirmAttendance(false);
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
              Void the run in Recent payroll runs if it was generated by mistake.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="text-terracotta h-4 w-4" />}
          label="Employees"
          value={preview ? String(preview.rows.length) : '-'}
        />
        <StatCard
          icon={<CalendarDays className="text-terracotta h-4 w-4" />}
          label="Gross salary"
          value={preview ? formatRupee(totals.gross) : '-'}
        />
        <StatCard
          icon={<Play className="text-terracotta h-4 w-4" />}
          label="Net payable"
          value={preview ? formatRupee(totals.net) : '-'}
        />
        <StatCard
          icon={<FileBarChart className="text-terracotta h-4 w-4" />}
          label="Total company cost"
          value={preview ? formatRupee(totals.companyCost) : '-'}
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
                    <TableHead className="text-right">Commission outstanding</TableHead>
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
                        {row.attendanceCompleteness.status !== 'COMPLETE' && (
                          <p className="mt-1 text-[10px] text-[#B7791F]">
                            {row.attendanceCompleteness.status === 'NOT_SCHEDULED'
                              ? 'no scheduled days'
                              : `${row.attendanceCompleteness.missingDays} unrecorded`}
                          </p>
                        )}
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

          {preview && !preview.alreadyGenerated && canRun && preview.attendanceSummary.message && (
            <div className="mt-3 rounded-lg border border-[#9B2226]/30 bg-[#FBECEC] p-4">
              <p className="text-espresso text-sm font-semibold">Attendance check</p>
              <p className="text-sand-ink mt-2 text-xs">{preview.attendanceSummary.message}</p>
              {preview.attendanceSummary.requiresConfirmation && (
                <label className="text-espresso mt-3 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={confirmAttendance}
                    onChange={(event) => setConfirmAttendance(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#9B2226]"
                  />
                  <span>
                    I reviewed attendance for this month and still want to generate payroll with
                    these records.
                  </span>
                </label>
              )}
            </div>
          )}

          {preview && !preview.alreadyGenerated && canRun && readiness.warnings.length > 0 && (
            <div className="mt-5 rounded-lg border border-[#B7791F]/40 bg-[#FDF6E7] p-4">
              <p className="text-espresso text-sm font-semibold">Review before generating</p>
              <ul className="text-sand-ink mt-2 list-disc space-y-1 pl-5 text-xs">
                {readiness.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
              {readiness.unsalariedStaff.length > 0 && (
                <p className="text-sand-ink mt-2 text-xs">
                  No salary configured: {listStaffNames(readiness.unsalariedStaff, 5)}
                </p>
              )}
              <label className="text-espresso mt-3 flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmWarnings}
                  onChange={(event) => setConfirmWarnings(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#B7791F]"
                />
                <span>
                  I understand these employees will be included at Rs 0.00 and I still want to
                  generate this run.
                </span>
              </label>
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
                disabled={
                  generateMutation.isPending ||
                  (readiness.requiresConfirmation && !confirmWarnings) ||
                  (preview?.attendanceSummary.requiresConfirmation && !confirmAttendance)
                }
                className="bg-espresso text-pearl hover:bg-espresso/90"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Generate payroll - {formatRupee(totals.net)} net
              </Button>
            </div>
          )}
          {preview && !preview.alreadyGenerated && canRun && rows.length === 0 && (
            <p className="mt-5 border-t border-mist pt-4 text-xs text-sand-ink">
              Generation is blocked until at least one active staff member exists.
            </p>
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
          {runsState === 'loading' ? (
            <Skeleton className="bg-linen h-24 rounded" />
          ) : runsState === 'error' ? (
            <div className="py-6 text-center text-sm">
              <p className="text-sand-ink">
                Could not load payroll runs:{' '}
                {runsQuery.error instanceof Error
                  ? runsQuery.error.message
                  : 'the request failed'}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => void runsQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : runsState === 'empty' ? (
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
                        <div className="flex items-center justify-end gap-3">
                          {run.status === 'GENERATED' && canRun && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPayRun(run);
                                setPayAccountId('');
                              }}
                              disabled={markPaidMutation.isPending}
                            >
                              Mark paid
                            </Button>
                          )}
                          {run.status === 'GENERATED' && canRun && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVoidRun(run)}
                              disabled={voidMutation.isPending}
                            >
                              Void
                            </Button>
                          )}
                          <Link
                            href={`/payroll/reports?month=${run.periodMonth}`}
                            className="text-terracotta text-xs underline"
                          >
                            Open
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={voidRun !== null}
        onOpenChange={(open) => {
          if (!open) setVoidRun(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Void payroll run</DialogTitle>
            <DialogDescription className="font-body text-sand-ink">
              Voiding {voidRun?.periodMonth ?? ''} deletes the generated run and its payslip
              snapshots and releases the commission reserved for it. The month can then be
              generated again. A paid run cannot be voided.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidRun(null)}>
              Cancel
            </Button>
            <Button
              className="bg-espresso text-pearl hover:bg-espresso/90"
              disabled={voidMutation.isPending || !voidRun}
              onClick={() => {
                if (!voidRun) return;
                voidMutation.mutate(voidRun.id);
              }}
            >
              {voidMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Void run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={payRun !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPayRun(null);
            setPayAccountId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Mark payroll paid</DialogTitle>
            <DialogDescription className="font-body text-sand-ink">
              Paying {payRun?.periodMonth ?? ''} posts salary, employer EPF/ETF and the
              reserved commission to expenses and the selected account, then settles the
              commission records. This cannot be undone here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="payroll-payment-account" className="text-espresso text-xs font-semibold">
              Payment account
            </Label>
            <Select value={payAccountId} onValueChange={setPayAccountId}>
              <SelectTrigger id="payroll-payment-account">
                <SelectValue placeholder="Select the paying account" />
              </SelectTrigger>
              <SelectContent>
                {(accountsQuery.data ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayRun(null)}>
              Cancel
            </Button>
            <Button
              className="bg-espresso text-pearl hover:bg-espresso/90"
              disabled={!payAccountId || markPaidMutation.isPending || !payRun}
              onClick={() => {
                if (!payRun || !payAccountId) return;
                markPaidMutation.mutate({ runId: payRun.id, paymentAccountId: payAccountId });
              }}
            >
              {markPaidMutation.isPending ? 'Posting…' : 'Mark paid & post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
