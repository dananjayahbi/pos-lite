'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Eye, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { CreateExpenseSchema, EXPENSE_CATEGORIES } from '@/lib/validators/expense.validators';
import type { CreateExpenseInput } from '@/lib/validators/expense.validators';
import { formatRupee } from '@/lib/format';
import Decimal from 'decimal.js';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReceiptUploader } from '@/components/expenses/ReceiptUploader';
import { PettyCashExportButton } from '@/components/petty-cash/PettyCashExportButton';

// ── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  category: string;
  amount: string;
  description: string;
  receiptImageUrl: string | null;
  pettyCashFundId: string | null;
  expenseDate: string;
  recordedBy: { email: string };
  createdAt: string;
}

interface ExpenseListResponse {
  expenses: Expense[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = EXPENSE_CATEGORIES;

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

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  RENT: 'bg-terracotta text-pearl',
  SALARIES: 'bg-espresso text-pearl',
  UTILITIES: 'bg-mist text-espresso',
  ADVERTISING: 'bg-sand text-espresso',
  MAINTENANCE: 'bg-linen text-espresso',
  MISCELLANEOUS: 'bg-pearl text-espresso border border-mist',
  OTHER: 'bg-pearl text-espresso border border-mist',
  STAFF_MEALS: 'bg-sand text-pearl',
  TEA_SUGAR: 'bg-linen text-espresso',
  OFFICE_STATIONERY: 'bg-mist text-espresso',
  TRAVEL: 'bg-pearl text-espresso border border-mist',
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Dialog / Sheet state
  const [createOpen, setCreateOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);

  // ── Query ──
  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (categoryFilter !== 'ALL') p.set('category', categoryFilter);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    p.set('page', String(page));
    p.set('pageSize', '20');
    return p.toString();
  }, [categoryFilter, dateFrom, dateTo, page]);

  const { data, isLoading } = useQuery<ExpenseListResponse>({
    queryKey: ['expenses', categoryFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      const res = await fetch(`/api/store/expenses?${buildParams()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch');
      return json.data;
    },
  });

  const totalAmount = (data?.expenses ?? []).reduce(
    (acc, e) => acc.plus(e.amount),
    new Decimal(0),
  );

  // Petty cash fund for optional linkage of standalone expenses (doc 36).
  const { data: fund } = useQuery<{ id: string; name: string; activeCategories: string[] } | null>({
    queryKey: ['petty-cash-fund'],
    queryFn: async () => {
      const res = await fetch('/api/store/petty-cash');
      const json = await res.json();
      if (!json.success) return null;
      return json.data;
    },
    retry: false,
  });

  // ── Create Form ──
  const createForm = useForm<CreateExpenseInput>({
    resolver: standardSchemaResolver(CreateExpenseSchema),
    defaultValues: {
      category: 'MISCELLANEOUS',
      amount: 0,
      description: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      pettyCashFundId: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const res = await fetch('/api/store/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to create');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense created');
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Edit Form ──
  const editForm = useForm<CreateExpenseInput>({
    resolver: standardSchemaResolver(CreateExpenseSchema),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateExpenseInput> }) => {
      const res = await fetch(`/api/store/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to update');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated');
      setEditExpense(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openEdit(expense: Expense) {
    setEditExpense(expense);
    editForm.reset({
      category: expense.category as CreateExpenseInput['category'],
      amount: parseFloat(expense.amount),
      description: expense.description,
      expenseDate: expense.expenseDate.slice(0, 10),
      receiptImageUrl: expense.receiptImageUrl ?? undefined,
      pettyCashFundId: expense.pettyCashFundId ?? undefined,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-espresso">Expenses</h1>
        <div className="flex items-center gap-2">
          <PettyCashExportButton
            className="border-mist text-espresso"
            dateFrom={dateFrom}
            dateTo={dateTo}
            category={categoryFilter}
          />
          <Link href="/expenses/cash-flow">
            <Button variant="outline" className="border-mist text-espresso">
              Cash Flow <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Label className="text-sm text-sand">Category</Label>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="border-mist">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm text-sand">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-40 border-mist"
          />
        </div>
        <div>
          <Label className="text-sm text-sand">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-40 border-mist"
          />
        </div>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-espresso text-pearl hover:bg-espresso/90">
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-espresso">Create Expense</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data as CreateExpenseInput))}
              className="space-y-4"
            >
              <div>
                <Label>Category</Label>
                <Select
                  value={createForm.watch('category')}
                  onValueChange={(v) => createForm.setValue('category', v as CreateExpenseInput['category'])}
                >
                  <SelectTrigger className="border-mist">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...createForm.register('amount', { valueAsNumber: true })}
                  className="border-mist"
                />
                {createForm.formState.errors.amount && (
                  <p className="text-sm text-terracotta">{createForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div>
                <Label>Description</Label>
                <Textarea {...createForm.register('description')} className="border-mist" />
                {createForm.formState.errors.description && (
                  <p className="text-sm text-terracotta">{createForm.formState.errors.description.message}</p>
                )}
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" {...createForm.register('expenseDate')} className="border-mist" />
              </div>
              {fund && (
                <div>
                  <Label>Petty Cash Fund (optional)</Label>
                  <Select
                    value={createForm.watch('pettyCashFundId') ?? ''}
                    onValueChange={(v) => createForm.setValue('pettyCashFundId', v === 'none' ? undefined : v)}
                  >
                    <SelectTrigger className="border-mist">
                      <SelectValue placeholder="Not linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      <SelectItem value={fund.id}>{fund.name}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Receipt (optional)</Label>
                <ReceiptUploader
                  value={createForm.watch('receiptImageUrl') ?? undefined}
                  onChange={(url) => createForm.setValue('receiptImageUrl', url)}
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full bg-espresso text-pearl">
                {createMutation.isPending ? 'Creating...' : 'Create Expense'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <ErrorBoundary>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-mist">
            <Table>
              <TableHeader>
                <TableRow className="bg-linen/40">
                  <TableHead className="text-espresso">Date</TableHead>
                  <TableHead className="text-espresso">Category</TableHead>
                  <TableHead className="text-espresso">Description</TableHead>
                  <TableHead className="text-right text-espresso">Amount</TableHead>
                  <TableHead className="text-espresso">Recorded By</TableHead>
                  <TableHead className="text-right text-espresso">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.expenses ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sand">
                      No expenses found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.expenses ?? []).map((expense) => (
                    <TableRow key={expense.id} className="hover:bg-linen/20">
                      <TableCell className="font-mono text-sm">{formatShortDate(expense.expenseDate)}</TableCell>
                      <TableCell>
                        <Badge className={CATEGORY_BADGE_COLORS[expense.category] ?? 'bg-pearl text-espresso'}>
                          {CATEGORY_LABEL[expense.category] ?? expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                      <TableCell className="text-right font-mono">{formatRupee(expense.amount)}</TableCell>
                      <TableCell className="text-sm text-sand">{expense.recordedBy.email}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-espresso"
                            onClick={() => setViewExpense(expense)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-espresso"
                            onClick={() => openEdit(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Row */}
          {(data?.expenses ?? []).length > 0 && (
            <div className="flex justify-end">
              <div className="rounded-lg border border-mist bg-linen/30 px-6 py-3">
                <span className="text-sm text-sand">Total (this page): </span>
                <span className="font-display text-lg font-bold text-espresso">
                  {formatRupee(totalAmount.toFixed(2))}
                </span>
              </div>
            </div>
          )}

          {/* Pagination */}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="border-mist"
              >
                Previous
              </Button>
              <span className="text-sm text-sand">
                Page {data.page} of {Math.ceil(data.total / data.pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / data.pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="border-mist"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      </ErrorBoundary>

      {/* View Dialog */}
      <Dialog open={viewExpense !== null} onOpenChange={(open) => { if (!open) setViewExpense(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Expense Details</DialogTitle>
          </DialogHeader>
          {viewExpense && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sand">Category</span>
                <Badge className={CATEGORY_BADGE_COLORS[viewExpense.category] ?? ''}>
                  {CATEGORY_LABEL[viewExpense.category] ?? viewExpense.category}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sand">Amount</span>
                <span className="font-mono font-semibold text-espresso">{formatRupee(viewExpense.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand">Date</span>
                <span>{formatShortDate(viewExpense.expenseDate)}</span>
              </div>
              <div>
                <span className="text-sand">Description</span>
                <p className="mt-1 text-sm text-espresso">{viewExpense.description}</p>
              </div>
              <div className="flex justify-between">
                <span className="text-sand">Recorded By</span>
                <span className="text-sm">{viewExpense.recordedBy.email}</span>
              </div>
              {viewExpense.receiptImageUrl && (
                <div>
                  <span className="text-sand">Receipt</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={viewExpense.receiptImageUrl}
                    alt="Receipt"
                    className="mt-2 h-32 w-full rounded border border-mist object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={editExpense !== null} onOpenChange={(open) => { if (!open) setEditExpense(null); }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-espresso">Edit Expense</SheetTitle>
          </SheetHeader>
          {editExpense && (
            <form
              onSubmit={editForm.handleSubmit((formData) =>
                editMutation.mutate({ id: editExpense.id, data: formData }),
              )}
              className="mt-6 space-y-4"
            >
              <div>
                <Label>Category</Label>
                <Select
                  value={editForm.watch('category')}
                  onValueChange={(v) => editForm.setValue('category', v as CreateExpenseInput['category'])}
                >
                  <SelectTrigger className="border-mist">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...editForm.register('amount', { valueAsNumber: true })}
                  className="border-mist"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea {...editForm.register('description')} className="border-mist" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" {...editForm.register('expenseDate')} className="border-mist" />
              </div>
              {fund && (
                <div>
                  <Label>Petty Cash Fund (optional)</Label>
                  <Select
                    value={editForm.watch('pettyCashFundId') ?? ''}
                    onValueChange={(v) => editForm.setValue('pettyCashFundId', v === 'none' ? undefined : v)}
                  >
                    <SelectTrigger className="border-mist">
                      <SelectValue placeholder="Not linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      <SelectItem value={fund.id}>{fund.name}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Receipt (optional)</Label>
                <ReceiptUploader
                  value={editForm.watch('receiptImageUrl') ?? undefined}
                  onChange={(url) => editForm.setValue('receiptImageUrl', url)}
                />
              </div>
              <Button type="submit" disabled={editMutation.isPending} className="w-full bg-espresso text-pearl">
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
