'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  Printer,
  ReceiptText,
} from 'lucide-react';
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
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { formatRupee } from '@/lib/format';

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

interface PayrollRunItem {
  id: string;
  userId: string;
  staffName: string;
  staffEmail: string;
  role: string;
  nic: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  epfNumber: string | null;
  etfNumber: string | null;
  basicSalary: string;
  allowances: string;
  overtimeMinutes: number;
  overtimeAmount: string;
  commissionAmount: string;
  grossSalary: string;
  noPayDays: string;
  noPayDeduction: string;
  advanceDeduction: string;
  totalDeductions: string;
  employeeEpf: string;
  employerEpf: string;
  employerEtf: string;
  netSalary: string;
  emailedAt: string | null;
  emailStatus: string | null;
}

interface PayrollRunDetail extends PayrollRunSummary {
  employeeEpfRate: string;
  employerEpfRate: string;
  employerEtfRate: string;
  totalBasic: string;
  totalAllowances: string;
  totalOvertime: string;
  totalCommission: string;
  totalDeductions: string;
  totalEmployeeEpf: string;
  totalEmployerEpf: string;
  totalEmployerEtf: string;
  items: PayrollRunItem[];
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function downloadUrl(
  runId: string,
  kind: 'bank-sheet' | 'statutory' | 'summary',
  format: 'xlsx' | 'pdf',
) {
  return `/api/store/payroll/runs/${runId}/exports/${kind}?format=${format}`;
}

function payslipUrl(runId: string, userId: string) {
  return `/api/store/payroll/runs/${runId}/payslips/${userId}`;
}

export default function PayrollReportsClient() {
  return (
    <Suspense fallback={<div className="text-sand-ink p-6 text-sm">Loading…</div>}>
      <PayrollReportsContent />
    </Suspense>
  );
}

function PayrollReportsContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canSend = hasPermission(PERMISSIONS.PAYROLL.runPayroll);
  const [month, setMonth] = useState(() => searchParams.get('month') ?? currentMonth());
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  const runsQuery = useQuery<PayrollRunSummary[]>({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const res = await fetch('/api/store/payroll/runs?limit=60');
      const json = (await res.json()) as { success: boolean; data?: PayrollRunSummary[] };
      return json.data ?? [];
    },
  });

  const summary = (runsQuery.data ?? []).find((run) => run.periodMonth === month);

  const runQuery = useQuery<PayrollRunDetail>({
    queryKey: ['payroll-run', summary?.id],
    queryFn: async () => {
      const res = await fetch(`/api/store/payroll/runs/${summary!.id}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: PayrollRunDetail;
        error?: { message: string };
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Failed to load payroll run');
      }
      return json.data;
    },
    enabled: Boolean(summary?.id),
  });

  const emailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`${payslipUrl(runQuery.data!.id, userId)}/email`, { method: 'POST' });
      const json = (await res.json()) as {
        success: boolean;
        data?: { delivered: boolean; reason: string | null; status: string };
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to email payslip');
      }
      return json.data!;
    },
    onMutate: (userId) => setSendingUserId(userId),
    onSuccess: (data) => {
      if (data.delivered) {
        toast.success('Payslip emailed');
      } else if (data.reason === 'provider-not-configured') {
        toast.warning('Email provider is not configured — payslip was not sent');
      } else {
        toast.error('Email provider rejected the send');
      }
      void queryClient.invalidateQueries({ queryKey: ['payroll-run', summary?.id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to email payslip');
    },
    onSettled: () => setSendingUserId(null),
  });

  const run = runQuery.data;

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-espresso text-2xl font-bold">
            Payroll reports & bank sheets
          </h1>
          <p className="text-sand-ink mt-1 text-sm">
            Monthly bank payment file, EPF/ETF returns and the company cost summary for a generated
            payroll run.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label
              htmlFor="report-month"
              className="text-espresso mb-1 block text-xs font-semibold"
            >
              Payroll month
            </Label>
            <Input
              id="report-month"
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
              className="w-48"
            />
          </div>
          <Button variant="outline" asChild>
            <Link href={`/payroll?month=${month}`}>
              <ReceiptText className="mr-2 h-4 w-4" />
              Run payroll
            </Link>
          </Button>
        </div>
      </div>

      {runsQuery.isLoading || runQuery.isLoading ? (
        <Skeleton className="bg-linen h-48 rounded" />
      ) : !summary ? (
        <Card className="border-mist">
          <CardContent className="text-sand-ink py-10 text-center text-sm">
            No payroll run exists for {month}.{' '}
            <Link href={`/payroll?month=${month}`} className="text-terracotta underline">
              Generate it first
            </Link>
            .
          </CardContent>
        </Card>
      ) : run ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Employees" value={String(run.items.length)} />
            <Stat label="Gross salary" value={formatRupee(run.totalGross)} />
            <Stat label="Net payable" value={formatRupee(run.totalNet)} />
            <Stat label="Total company cost" value={formatRupee(run.totalCompanyCost)} />
          </div>

          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso text-base">
                Company cost — {run.periodMonth}
              </CardTitle>
              <CardDescription>
                Basic + allowances + OT + commission, employee EPF deduction, and employer EPF/ETF
                contributions (employee EPF {Number(run.employeeEpfRate)}%, employer EPF{' '}
                {Number(run.employerEpfRate)}%, ETF {Number(run.employerEtfRate)}%).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <CostRow label="Basic salaries" value={run.totalBasic} />
              <CostRow label="Allowances" value={run.totalAllowances} />
              <CostRow label="Overtime" value={run.totalOvertime} />
              <CostRow label="Sales commission" value={run.totalCommission} />
              <CostRow label="Gross salary" value={run.totalGross} strong />
              <CostRow label="Deductions (no-pay + advances)" value={run.totalDeductions} />
              <CostRow label="Employee EPF" value={run.totalEmployeeEpf} />
              <CostRow label="Employer EPF" value={run.totalEmployerEpf} />
              <CostRow label="Employer ETF" value={run.totalEmployerEtf} />
              <CostRow label="Net salaries paid" value={run.totalNet} strong />
              <CostRow label="Total company cost" value={run.totalCompanyCost} strong />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <ExportCard
              icon={<FileSpreadsheet className="h-5 w-5 text-[#2D6A4F]" />}
              title="Bank salary sheet"
              description="Employee names, bank accounts and net salary — ready for corporate banking batch upload."
              links={[
                { href: downloadUrl(run.id, 'bank-sheet', 'xlsx'), label: 'Excel' },
                { href: downloadUrl(run.id, 'bank-sheet', 'pdf'), label: 'PDF' },
              ]}
            />
            <ExportCard
              icon={<FileText className="h-5 w-5 text-[#1D4E89]" />}
              title="EPF / ETF monthly returns"
              description="C-Form format with employee NIC, EPF/ETF numbers, earnings and contribution split."
              links={[
                { href: downloadUrl(run.id, 'statutory', 'xlsx'), label: 'Excel' },
                { href: downloadUrl(run.id, 'statutory', 'pdf'), label: 'PDF' },
              ]}
            />
            <ExportCard
              icon={<Download className="text-terracotta h-5 w-5" />}
              title="Monthly payroll summary"
              description="Company expenditure for the month: salaries, OT, commissions, EPF/ETF and net pay."
              links={[
                { href: downloadUrl(run.id, 'summary', 'pdf'), label: 'PDF' },
                { href: downloadUrl(run.id, 'summary', 'xlsx'), label: 'Excel' },
              ]}
            />
          </div>

          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso text-base">
                Payslips & bank details
              </CardTitle>
              <CardDescription>
                Print or download the branded PDF, or email it directly to the employee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[170px]">Employee</TableHead>
                      <TableHead>Bank account</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net pay</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="text-espresso font-medium">{item.staffName}</p>
                          <p className="text-mist-ink text-xs">{item.staffEmail}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p>{item.bankName ?? '—'}</p>
                          <p className="text-mist-ink font-mono">
                            {item.bankAccountNumber ?? 'No account number'}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatRupee(item.grossSalary)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatRupee(item.totalDeductions)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {formatRupee(item.netSalary)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.emailStatus === 'SENT' ? (
                            <span className="text-[#2D6A4F]">Sent</span>
                          ) : item.emailStatus === 'NOT_CONFIGURED' ? (
                            <span className="text-[#B7791F]">Not configured</span>
                          ) : item.emailStatus === 'FAILED' ? (
                            <span className="text-[#9B2226]">Failed</span>
                          ) : (
                            <span className="text-mist-ink">Not sent</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(payslipUrl(run.id, item.userId), '_blank', 'noopener')
                              }
                              title="Print or download payslip"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(payslipUrl(run.id, item.userId), '_blank', 'noopener')
                              }
                              title="Download payslip PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canSend && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={sendingUserId === item.userId}
                                onClick={() => emailMutation.mutate(item.userId)}
                                title="Email payslip"
                              >
                                {sendingUserId === item.userId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-mist">
          <CardContent className="text-sand-ink py-10 text-center text-sm">
            Could not load this payroll run.
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-mist">
      <CardContent className="p-4">
        <p className="text-mist-ink text-xs tracking-wide uppercase">{label}</p>
        <p className="text-espresso mt-1 font-mono text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function CostRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border-mist/60 flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sand-ink">{label}</span>
      <span className={strong ? 'text-espresso font-mono font-bold' : 'text-espresso font-mono'}>
        {formatRupee(value)}
      </span>
    </div>
  );
}

function ExportCard({
  icon,
  title,
  description,
  links,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <Card className="border-mist">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display text-espresso text-sm font-semibold">{title}</h2>
        </div>
        <p className="text-sand-ink text-xs">{description}</p>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Button key={link.href} size="sm" variant="outline" asChild>
              <a href={link.href} download>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {link.label}
              </a>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
