'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowRight, ArrowDownToLine, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES } from '@/lib/validators/expense.validators';
import { formatRupee } from '@/lib/format';
import { staffDisplayName } from '@/lib/utils/staff-name';
import {
  buildRunningLedger,
  ledgerDisclosure,
  type PettyCashLedgerInput,
  type PettyCashLedgerRow,
} from '@/lib/petty-cash/ledger';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PettyCashBalanceEquation } from '@/components/petty-cash/PettyCashBalanceEquation';
import { PettyCashExportButton } from '@/components/petty-cash/PettyCashExportButton';
import { PettyCashTopUpDialog } from '@/components/petty-cash/PettyCashTopUpDialog';
import {
  PettyCashSettingsDialog,
  type PettyCashSettingsPayload,
} from '@/components/petty-cash/PettyCashSettingsDialog';
import type { PettyCashTopUpPayload } from '@/components/petty-cash/PettyCashTopUpDialog';
import type { PaymentAccount } from '@/components/payment-accounts/paymentAccountTypes';

// ── Types ────────────────────────────────────────────────────────────────────

interface FundExpense {
  id: string;
  category: string;
  amount: string;
  description: string;
  receiptImageUrl: string | null;
  expenseDate: string;
  recordedBy: { email: string };
}

interface FundPaymentAccount {
  id: string;
  name: string;
  type: string;
}

interface PettyCashTopUp {
  id: string;
  entryDate: string;
  createdAt: string;
  description: string;
  amount: string;
  recordedByEmail: string | null;
}

interface PettyCashFund {
  id: string;
  name: string;
  currency: string;
  openingBalance: string;
  currentBalance: string;
  lowBalanceThreshold: string | null;
  isActive: boolean;
  activeCategories: string[];
  expenses: FundExpense[];
  paymentAccount?: FundPaymentAccount | null;
}

interface BalanceEquation {
  openingBalance: number;
  totalTopUps: number;
  totalExpenses: number;
  currentBalance: number;
}

interface LedgerMeta {
  expenseShown: number;
  expenseCount: number;
  expenseTotal: number;
  topUpShown: number;
  topUpCount: number;
  topUpTotal: number;
  limit: number;
}

interface FundResponse {
  fund: PettyCashFund | null;
  balance: BalanceEquation | null;
  topUps: PettyCashTopUp[];
  ledger?: LedgerMeta | null;
  setupRequired: boolean;
  multipleFunds: boolean;
  fundCount?: number;
  message?: string;
}

type LedgerRow = PettyCashLedgerRow & {
  category?: string | null | undefined;
  receiptImageUrl?: string | null | undefined;
};

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

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
  STAFF_COMMISSIONS: 'Staff Commissions',
};

// ── Page ─────────────────────────────────────────────────────────────────────

interface PettyCashDashboardProps {
  canManage: boolean;
  canManageSettings: boolean;
  canCreateExpense: boolean;
}

export default function PettyCashDashboard({
  canManage,
  canManageSettings,
  canCreateExpense,
}: PettyCashDashboardProps) {
  const queryClient = useQueryClient();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Pending category edits win over the server value, so no sync effect (and no
  // cascading render) is needed when the fund query refreshes.
  const [categoryEdits, setCategoryEdits] = useState<string[] | null>(null);

  const { data: response, isLoading } = useQuery<FundResponse>({
    queryKey: ['petty-cash'],
    queryFn: async () => {
      const res = await fetch('/api/store/petty-cash');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load fund');
      return {
        fund: json.data as PettyCashFund | null,
        balance: (json.balance ?? null) as BalanceEquation | null,
        topUps: (json.topUps ?? []) as PettyCashTopUp[],
        ledger: (json.ledger ?? null) as LedgerMeta | null,
        setupRequired: Boolean(json.setupRequired),
        multipleFunds: Boolean(json.multipleFunds),
        ...(typeof json.fundCount === 'number' ? { fundCount: json.fundCount } : {}),
        ...(typeof json.message === 'string' ? { message: json.message } : {}),
      };
    },
  });

  const fund = response?.fund ?? null;
  const toggleCategories = categoryEdits ?? fund?.activeCategories ?? [];

  // Active source accounts for "Add Cash In". The fund's own account is
  // excluded by the dialog.
  const { data: paymentAccounts = [] } = useQuery<PaymentAccount[]>({
    queryKey: ['payment-accounts', 'petty-cash-topup'],
    queryFn: async () => {
      const res = await fetch('/api/store/payment-accounts?status=ACTIVE');
      const json = await res.json();
      if (!json.success) return [];
      return (json.data?.accounts ?? []) as PaymentAccount[];
    },
    retry: false,
  });

  const invalidateFundViews = () => {
    queryClient.invalidateQueries({ queryKey: ['petty-cash'] });
    queryClient.invalidateQueries({ queryKey: ['petty-cash-fund'] });
    queryClient.invalidateQueries({ queryKey: ['payment-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };

  const categoriesMutation = useMutation({
    mutationFn: async (activeCategories: string[]) => {
      const res = await fetch('/api/store/petty-cash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId: fund?.id, activeCategories }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Update failed');
      }
      return json.data;
    },
    onSuccess: () => {
      setCategoryEdits(null);
      invalidateFundViews();
      toast.success('Petty cash categories updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settingsMutation = useMutation({
    mutationFn: async (payload: PettyCashSettingsPayload) => {
      const res = await fetch('/api/store/petty-cash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId: fund?.id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Settings update failed');
      }
      return json.data;
    },
    onSuccess: () => {
      invalidateFundViews();
      toast.success('Petty cash settings updated');
      setSettingsOpen(false);
    },
  });

  const topUpMutation = useMutation({
    mutationFn: async (payload: PettyCashTopUpPayload) => {
      const res = await fetch('/api/store/petty-cash/top-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Top-up failed');
      }
      return json.data;
    },
    onSuccess: () => {
      invalidateFundViews();
      toast.success('Cash added to petty cash');
      setTopUpOpen(false);
    },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/petty-cash/setup', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Setup failed');
      }
      return json.data;
    },
    onSuccess: () => {
      invalidateFundViews();
      toast.success('Petty cash set up');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleCategory = (cat: string) => {
    setCategoryEdits((prev) => {
      const base = prev ?? fund?.activeCategories ?? [];
      return base.includes(cat) ? base.filter((c) => c !== cat) : [...base, cat];
    });
  };

  const ledgerView = useMemo(() => {
    const inputs: PettyCashLedgerInput[] = [
      ...(fund?.expenses ?? []).map((expense) => ({
        id: expense.id,
        kind: 'expense' as const,
        date: expense.expenseDate,
        createdAt: null,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        receiptImageUrl: expense.receiptImageUrl,
        recordedByEmail: expense.recordedBy?.email ?? null,
      })),
      ...(response?.topUps ?? []).map((topUp) => ({
        id: topUp.id,
        kind: 'topup' as const,
        date: topUp.entryDate,
        createdAt: topUp.createdAt,
        category: null,
        description: topUp.description,
        amount: topUp.amount,
        receiptImageUrl: null,
        recordedByEmail: topUp.recordedByEmail ?? null,
      })),
    ];
    return buildRunningLedger(inputs, response?.balance?.currentBalance ?? 0);
  }, [fund?.expenses, response?.topUps, response?.balance?.currentBalance]);

  const ledgerRows: LedgerRow[] = ledgerView.rows;
  const expenseDisclosure = ledgerDisclosure(
    response?.ledger?.expenseShown ?? 0,
    response?.ledger?.expenseCount ?? 0,
    response?.ledger?.limit,
  );
  const topUpDisclosure = ledgerDisclosure(
    response?.ledger?.topUpShown ?? 0,
    response?.ledger?.topUpCount ?? 0,
    response?.ledger?.limit,
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-espresso">Petty Cash</h1>
        <div className="flex flex-wrap items-center gap-2">
          {fund && (
            <PettyCashExportButton className="border-mist text-espresso" />
          )}
          {fund && canManageSettings && (
            <Button
              variant="outline"
              className="border-mist text-espresso"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          )}
          {fund && canManage && (
            <Button
              className="bg-espresso text-pearl hover:bg-espresso/90"
              onClick={() => setTopUpOpen(true)}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Add Cash In
            </Button>
          )}
          {fund && canCreateExpense && (
            <Link href={`/expenses?fundId=${encodeURIComponent(fund.id)}`}>
              <Button variant="outline" className="border-mist text-espresso">
                Add Expense <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <ErrorBoundary>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : response?.multipleFunds ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-espresso">
                Multiple petty-cash funds found
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-sand-ink">
                {response.message ??
                  'This store has more than one active petty-cash fund. Reads and exports stop here instead of silently using the first one.'}
              </p>
              <p className="text-sm text-sand-ink">
                Resolve the duplicate funds with the owner before recording more petty-cash activity.
              </p>
            </CardContent>
          </Card>
        ) : response?.setupRequired ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-espresso">
                Petty cash is not set up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-sand-ink">
                Opening this page no longer creates a fund or a payment account. Set up the
                default petty-cash fund explicitly when you are ready.
              </p>
              {canManage ? (
                <Button
                  onClick={() => setupMutation.mutate()}
                  disabled={setupMutation.isPending}
                  className="bg-espresso text-pearl hover:bg-espresso/90"
                >
                  {setupMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Set up Petty Cash
                </Button>
              ) : (
                <p className="text-sm text-sand-ink">
                  Ask an owner or manager to set up petty cash for this store.
                </p>
              )}
            </CardContent>
          </Card>
        ) : fund ? (
          <>
            {/* Balance equation (doc 39) */}
            {response?.balance && (
              <PettyCashBalanceEquation
                openingBalance={response.balance.openingBalance}
                totalTopUps={response.balance.totalTopUps}
                totalExpenses={response.balance.totalExpenses}
                currentBalance={response.balance.currentBalance}
                currency={fund.currency}
              />
            )}

            {/* Balance summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal text-sand-ink">Opening Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold text-espresso">
                    {formatRupee(fund.openingBalance)}
                  </p>
                  <p className="text-sm text-sand-ink">{fund.currency}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal text-sand-ink">Current Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold text-terracotta">
                    {formatRupee(fund.currentBalance)}
                  </p>
                  <p className="text-sm text-sand-ink">
                    {fund.lowBalanceThreshold
                      ? `Low-balance alert at ${formatRupee(fund.lowBalanceThreshold)}`
                      : 'No low-balance threshold set'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal text-sand-ink">Fund</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-display text-xl font-bold text-espresso">{fund.name}</p>
                  <Badge className="bg-espresso text-pearl">
                    {fund.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {fund.paymentAccount ? (
                    <Link
                      href="/payment-accounts"
                      className="block text-xs text-terracotta underline-offset-2 hover:underline"
                    >
                      Payment account: {fund.paymentAccount.name}
                    </Link>
                  ) : (
                    <p className="text-xs text-sand-ink">Payment account not linked</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Active categories */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-espresso">Active Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-sand-ink">
                  Enable the expense categories shown when logging petty-cash expenses.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center justify-between rounded-lg border border-mist px-3 py-2"
                    >
                      <span className="text-sm text-espresso">{CATEGORY_LABEL[cat] ?? cat}</span>
                      <Switch
                        checked={toggleCategories.includes(cat)}
                        onCheckedChange={() => toggleCategory(cat)}
                        disabled={!canManage}
                      />
                    </label>
                  ))}
                </div>
                {canManage && (
                  <Button
                    onClick={() => categoriesMutation.mutate(toggleCategories)}
                    disabled={categoriesMutation.isPending}
                    variant="outline"
                    className="border-mist text-espresso"
                  >
                    {categoriesMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Categories
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Linked expenses + cash-in transactions */}
            <div className="rounded-lg border border-mist">
              <div className="border-b border-mist bg-linen/40 px-4 py-3">
                <h2 className="font-display font-semibold text-espresso">Linked Expenses</h2>
                <p className="text-xs text-sand-ink">
                  Expenses and Cash In top-ups, newest first. The running balance
                  column ends at the live fund balance.
                </p>
                {response?.ledger && (
                  <p className="mt-1 text-xs text-sand-ink">
                    Showing latest {expenseDisclosure.shown} of {expenseDisclosure.total} expenses
                    ({formatRupee(response.ledger.expenseTotal)} total) and latest{' '}
                    {topUpDisclosure.shown} of {topUpDisclosure.total} cash-in rows
                    ({formatRupee(response.ledger.topUpTotal)} total). The balance equation
                    above uses all rows.
                    {expenseDisclosure.truncated || topUpDisclosure.truncated
                      ? ' Older rows are not listed here; use Export for the full audit trail.'
                      : ''}
                  </p>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-linen/40">
                    <TableHead className="text-espresso">Date</TableHead>
                    <TableHead className="text-espresso">Category</TableHead>
                    <TableHead className="text-espresso">Description</TableHead>
                    <TableHead className="text-espresso">Recorded By</TableHead>
                    <TableHead className="text-right text-espresso">Amount</TableHead>
                    <TableHead className="text-right text-espresso">Running Balance</TableHead>
                    <TableHead className="text-espresso">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sand-ink">
                        No expenses or top-ups linked to this fund yet. Use Add Cash In or the
                        Expenses page.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerRows.map((row) => (
                      <TableRow key={`${row.kind}-${row.id}`} className="hover:bg-linen/20">
                        <TableCell className="font-mono text-sm">
                          {formatShortDate(row.date)}
                        </TableCell>
                        <TableCell>
                          {row.kind === 'topup' ? (
                            <Badge className="border border-green-200 bg-green-50 text-green-700">
                              Cash In
                            </Badge>
                          ) : (
                            <Badge className="bg-linen text-espresso">
                              {CATEGORY_LABEL[row.category ?? ''] ?? row.category ?? '-'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">
                          {row.description}
                        </TableCell>
                        <TableCell className="text-sm text-sand-ink">
                          {row.recordedByEmail
                            ? staffDisplayName(row.recordedByEmail)
                            : '-'}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            row.kind === 'topup' ? 'font-semibold text-green-700' : ''
                          }`}
                        >
                          {row.kind === 'topup'
                            ? `+${formatRupee(row.amount)}`
                            : `-${formatRupee(row.amount)}`}
                        </TableCell>
                        <TableCell className="text-right font-mono text-espresso">
                          {formatRupee(row.runningBalance)}
                        </TableCell>
                        <TableCell>
                          {row.kind === 'expense' && row.receiptImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.receiptImageUrl}
                              alt="Receipt"
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <span className="text-sm text-sand-ink">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sand-ink">Failed to load petty cash fund.</p>
        )}
      </ErrorBoundary>

      {fund && canManage && (
        <PettyCashTopUpDialog
          open={topUpOpen}
          onOpenChange={setTopUpOpen}
          fundName={fund.name}
          paymentAccountId={fund.paymentAccount?.id ?? null}
          accounts={paymentAccounts}
          onSubmit={async (payload) => {
            await topUpMutation.mutateAsync(payload);
          }}
        />
      )}
      {fund && canManageSettings && (
        <PettyCashSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          name={fund.name}
          lowBalanceThreshold={fund.lowBalanceThreshold}
          onSubmit={async (payload) => {
            await settingsMutation.mutateAsync(payload);
          }}
        />
      )}
    </div>
  );
}
