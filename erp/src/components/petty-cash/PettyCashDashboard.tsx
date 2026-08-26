'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES } from '@/lib/validators/expense.validators';
import { formatRupee } from '@/lib/format';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PettyCashBalanceEquation } from '@/components/petty-cash/PettyCashBalanceEquation';
import { PettyCashExportButton } from '@/components/petty-cash/PettyCashExportButton';

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
}

interface BalanceEquation {
  openingBalance: number;
  totalExpenses: number;
  currentBalance: number;
}

interface FundResponse {
  fund: PettyCashFund;
  balance: BalanceEquation;
}

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
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PettyCashDashboard() {
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery<FundResponse>({
    queryKey: ['petty-cash'],
    queryFn: async () => {
      const res = await fetch('/api/store/petty-cash');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load fund');
      return { fund: json.data, balance: json.balance };
    },
  });

  const fund = response?.fund;

  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [threshold, setThreshold] = useState('');
  const [toggleCategories, setToggleCategories] = useState<string[]>([]);

  const syncForm = (f: PettyCashFund | undefined) => {
    if (!f) return;
    setName(f.name);
    setOpeningBalance(f.openingBalance);
    setThreshold(f.lowBalanceThreshold ?? '');
    setToggleCategories(f.activeCategories);
  };

  useEffect(() => {
    if (fund) syncForm(fund);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fund?.id]);

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/store/petty-cash', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId: fund?.id, ...body }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Update failed');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash'] });
      toast.success('Petty cash fund updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleCategory = (cat: string) => {
    const next = toggleCategories.includes(cat)
      ? toggleCategories.filter((c) => c !== cat)
      : [...toggleCategories, cat];
    setToggleCategories(next);
  };

  const openBalance = parseFloat(openingBalance || '0') || 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-espresso">Petty Cash</h1>
        <div className="flex items-center gap-2">
          <PettyCashExportButton className="border-mist text-espresso" />
          <Link href="/expenses">
            <Button variant="outline" className="border-mist text-espresso">
              Add Expense <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <ErrorBoundary>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : fund ? (
          <>
            {/* Balance equation (doc 39) */}
            {response?.balance && (
              <PettyCashBalanceEquation
                openingBalance={response.balance.openingBalance}
                totalExpenses={response.balance.totalExpenses}
                currentBalance={response.balance.currentBalance}
                currency={fund.currency}
              />
            )}

            {/* Balance summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal text-sand">Opening Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold text-espresso">
                    {formatRupee(fund.openingBalance)}
                  </p>
                  <p className="text-sm text-sand">{fund.currency}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal text-sand">Current Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold text-terracotta">
                    {formatRupee(fund.currentBalance)}
                  </p>
                  <p className="text-sm text-sand">
                    {fund.lowBalanceThreshold
                      ? `Low-balance alert at ${formatRupee(fund.lowBalanceThreshold)}`
                      : 'No low-balance threshold set'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal text-sand">Fund</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-display text-xl font-bold text-espresso">{fund.name}</p>
                  <Badge className="bg-espresso text-pearl">
                    {fund.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Configuration */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-espresso">Fund Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Fund Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="border-mist"
                      placeholder="Main Petty Cash"
                    />
                  </div>
                  <div>
                    <Label>Opening Balance (LKR)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      className="border-mist"
                    />
                  </div>
                  <div>
                    <Label>Low-Balance Threshold (LKR)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="border-mist"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateMutation.mutate({ name })}
                      disabled={updateMutation.isPending}
                      variant="outline"
                      className="border-mist text-espresso"
                    >
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Name
                    </Button>
                    <Button
                      onClick={() => updateMutation.mutate({ openingBalance: openBalance, lowBalanceThreshold: threshold === '' ? null : parseFloat(threshold) })}
                      disabled={updateMutation.isPending}
                      className="bg-espresso text-pearl hover:bg-espresso/90"
                    >
                      Save Balance
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-espresso">Active Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-sand">
                    Enable the expense categories shown when logging petty-cash expenses.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <label
                        key={cat}
                        className="flex items-center justify-between rounded-lg border border-mist px-3 py-2"
                      >
                        <span className="text-sm text-espresso">{CATEGORY_LABEL[cat] ?? cat}</span>
                        <Switch
                          checked={toggleCategories.includes(cat)}
                          onCheckedChange={() => toggleCategory(cat)}
                        />
                      </label>
                    ))}
                  </div>
                  <Button
                    onClick={() => updateMutation.mutate({ activeCategories: toggleCategories })}
                    disabled={updateMutation.isPending}
                    variant="outline"
                    className="border-mist text-espresso"
                  >
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Categories
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Linked expenses */}
            <div className="rounded-lg border border-mist">
              <div className="border-b border-mist bg-linen/40 px-4 py-3">
                <h2 className="font-display font-semibold text-espresso">Linked Expenses</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-linen/40">
                    <TableHead className="text-espresso">Date</TableHead>
                    <TableHead className="text-espresso">Category</TableHead>
                    <TableHead className="text-espresso">Description</TableHead>
                    <TableHead className="text-right text-espresso">Amount</TableHead>
                    <TableHead className="text-espresso">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fund.expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sand">
                        No expenses linked to this fund yet. Add expenses from the Expenses page.
                      </TableCell>
                    </TableRow>
                  ) : (
                    fund.expenses.map((expense) => (
                      <TableRow key={expense.id} className="hover:bg-linen/20">
                        <TableCell className="font-mono text-sm">{formatShortDate(expense.expenseDate)}</TableCell>
                        <TableCell>
                          <Badge className="bg-linen text-espresso">
                            {CATEGORY_LABEL[expense.category] ?? expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{expense.description}</TableCell>
                        <TableCell className="text-right font-mono">-{formatRupee(expense.amount)}</TableCell>
                        <TableCell>
                          {expense.receiptImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={expense.receiptImageUrl}
                              alt="Receipt"
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <span className="text-sm text-sand">—</span>
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
          <p className="text-sand">Failed to load petty cash fund.</p>
        )}
      </ErrorBoundary>
    </div>
  );
}
