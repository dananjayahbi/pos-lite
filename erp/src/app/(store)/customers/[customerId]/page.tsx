'use client';

import { useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { CustomerSheet } from '@/components/customers/CustomerSheet';
import { LoyaltyBadge } from '@/components/customers/LoyaltyBadge';
import { CustomerValueInsights } from '@/components/customers/CustomerValueInsights';
import {
  returnItemCount,
  summarizeCustomerReturns,
} from '@/components/customers/customerReturns';
import { saleItemCount } from '@/components/customers/customerPurchases';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  CustomerLoadError,
  customerErrorStatus,
  resolveCustomerDetailState,
} from '@/lib/services/customerLoad.core';
import { resolveCustomerEditAccess } from '@/lib/services/customerPermissions.core';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface SaleLine {
  id: string;
  productNameSnapshot: string;
  quantity: number;
  lineTotalAfterDiscount: string | number;
}

interface Payment {
  id: string;
  method: string;
  amount: string | number;
}

interface Sale {
  id: string;
  status: string;
  totalAmount: string | number;
  paymentMethod: string | null;
  completedAt: string | null;
  createdAt: string;
  lines: SaleLine[];
  payments: Payment[];
}

interface CustomerReturn {
  id: string;
  originalSaleId: string;
  refundAmount: string | number;
  refundMethod: string;
  status: string;
  createdAt: string;
  lines: { quantity: number }[];
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  gender?: string | null;
  birthday?: string | null;
  tags: string[];
  notes?: string | null;
  creditBalance: string | number;
  totalSpend: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastPurchaseAt?: string | null;
  orderCount: number;
  visitCount: number;
  avgOrderValue: string;
  preferredCategories: {
    categoryId: string;
    categoryName: string;
    quantity: number;
    lineTotal: string;
  }[];
  sales: Sale[];
  /** ARGUS #310: returns joined through the original sale. */
  returns?: CustomerReturn[];
}

type Tab = 'purchases' | 'returns' | 'about';

const REFUND_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD_REVERSAL: 'Card Reversal',
  STORE_CREDIT: 'Store Credit',
  EXCHANGE: 'Exchange',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  const [activeTab, setActiveTab] = useState<Tab>('purchases');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<{
    success: boolean;
    data: CustomerDetail;
  }>({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/store/customers/${customerId}`);
      let json: {
        success?: boolean;
        data?: CustomerDetail;
        error?: { message?: string };
      } | null = null;
      try {
        json = await res.json();
      } catch {
        // A non-JSON error response still needs a status-aware load error.
      }
      if (!res.ok || !json?.success || !json.data) {
        throw new CustomerLoadError(
          json?.error?.message ??
            (res.status === 404 ? 'Customer not found' : 'Failed to load customer'),
          res.status,
        );
      }
      return { success: true, data: json.data };
    },
    // The page owns the retry button; React Query retries would only delay the
    // explicit 404/error state.
    retry: false,
  });

  const customer = data?.data;
  const detailState = resolveCustomerDetailState({
    isLoading,
    isError,
    errorStatus: customerErrorStatus(error),
    hasCustomer: Boolean(customer),
  });
  const loadErrorMessage =
    error instanceof Error ? error.message : 'Failed to load customer';

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  }, [queryClient, customerId]);

  const handleDeleteCustomer = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/store/customers/${customerId}`, {
        method: 'DELETE',
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: { message?: string } }
        | null;

      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? 'Failed to delete customer');
        return;
      }

      toast.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push('/customers');
      router.refresh();
    } catch {
      toast.error('Failed to delete customer');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }, [customerId, queryClient, router]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-LK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'purchases', label: 'Purchase History' },
    { key: 'returns', label: 'Returns' },
    { key: 'about', label: 'About / Notes' },
  ];

  if (detailState === 'loading') {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (detailState === 'error') {
    return (
      <div role="alert" className="text-center py-20 text-sand-ink">
        <AlertCircle className="mx-auto h-6 w-6 text-terracotta" />
        <p className="mt-2 font-medium text-espresso">Could not load this customer</p>
        <p className="mt-1 text-sm">{loadErrorMessage}</p>
        <Button
          variant="outline"
          className="mt-4"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? 'Retrying...' : 'Retry'}
        </Button>
      </div>
    );
  }

  if (detailState === 'not-found') {
    return (
      <div className="text-center py-20 text-sand-ink">
        <p>Customer not found</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/customers">Back to Customers</Link>
        </Button>
      </div>
    );
  }

  if (!customer) {
    // `detailState` is only 'ready' when the response carried a customer.
    return null;
  }

  const completedSales = customer.sales.filter((s) => s.status === 'COMPLETED');
  const customerReturns = customer.returns ?? [];
  const returnSummary = summarizeCustomerReturns(customerReturns);
  const canDeleteCustomer = !permissionsLoading && hasPermission(PERMISSIONS.CUSTOMER.deleteCustomer);
  const { canEdit: canEditCustomer } = resolveCustomerEditAccess({
    permissionsLoading,
    hasEditPermission: hasPermission(PERMISSIONS.CUSTOMER.editCustomer),
  });

  const getCreditColor = (val: string | number) => {
    const n = Number(val);
    if (n > 0) return 'text-green-700';
    if (n < 0) return 'text-terracotta';
    return 'text-espresso';
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/customers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Customers
        </Link>
      </Button>

      {/* Profile Header */}
      <div className="flex items-start gap-4">
        <div className="shrink-0 h-16 w-16 rounded-full bg-terracotta/20 text-terracotta flex items-center justify-center text-xl font-display font-bold">
          {getInitials(customer.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold text-espresso truncate">
              {customer.name}
            </h1>
            <LoyaltyBadge orderCount={customer.orderCount} />
            {canEditCustomer && (
              <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            {canDeleteCustomer && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:text-red-700"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>
          <div className="mt-0.5 space-y-0.5">
            <p className="text-sm text-sand-ink font-mono">{customer.phone}</p>
            {customer.phone2 && (
              <p className="text-sm text-sand-ink font-mono">
                Alt: {customer.phone2}
              </p>
            )}
          </div>
          {customer.email && (
            <p className="text-sm text-sand-ink mt-0.5">{customer.email}</p>
          )}
          {(customer.address || customer.city) && (
            <p className="text-sm text-sand-ink mt-0.5">
              {[customer.address, customer.city].filter(Boolean).join(', ')}
            </p>
          )}
          {customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {customer.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand-ink uppercase tracking-wide">
              Total Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-mono font-semibold text-espresso">
              {formatRupee(customer.totalSpend)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand-ink uppercase tracking-wide">
              Avg Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-mono font-semibold text-espresso">
              {formatRupee(customer.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand-ink uppercase tracking-wide">
              Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-mono font-semibold text-espresso">
              {customer.visitCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-body text-sand-ink uppercase tracking-wide">
              Credit Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-mono font-semibold ${getCreditColor(customer.creditBalance)}`}>
              {formatRupee(customer.creditBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Value Insights (doc 21) */}
      <CustomerValueInsights
        lastPurchaseAt={customer.lastPurchaseAt}
        preferredCategories={customer.preferredCategories}
      />

      {/* Manual Tabs */}
      <div className="flex gap-1 border-b border-sand/30">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-terracotta text-terracotta'
                : 'border-transparent text-sand-ink hover:text-espresso'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'purchases' && (
        <div className="rounded-lg border border-sand/30 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt No.</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sand-ink">
                    No purchase history
                  </TableCell>
                </TableRow>
              ) : (
                completedSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">
                      {formatDate(sale.completedAt ?? sale.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {sale.id.slice(-8).toUpperCase()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {saleItemCount(sale.lines)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRupee(sale.totalAmount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sale.paymentMethod ?? '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="rounded-lg border border-sand/30 bg-white">
          {returnSummary.count > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand/30 px-4 py-3">
              <p className="text-sm text-sand-ink">
                {returnSummary.count} return{returnSummary.count === 1 ? '' : 's'} ·{' '}
                {returnSummary.totalItems} item{returnSummary.totalItems === 1 ? '' : 's'} returned
              </p>
              <p className="font-mono text-sm font-medium text-espresso">
                {formatRupee(returnSummary.totalRefund)} refunded
              </p>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Return No.</TableHead>
                <TableHead>Original Sale</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Refund Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sand-ink">
                    No returns on record
                  </TableCell>
                </TableRow>
              ) : (
                customerReturns.map((returnRecord) => (
                  <TableRow key={returnRecord.id}>
                    <TableCell className="text-sm">
                      {formatDate(returnRecord.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href="/returns"
                        className="text-terracotta underline-offset-2 hover:underline"
                        title="Open the returns ledger"
                      >
                        {returnRecord.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/sales/${returnRecord.originalSaleId}`}
                        className="text-terracotta underline-offset-2 hover:underline"
                        title="Open the original sale"
                      >
                        {returnRecord.originalSaleId.slice(0, 8).toUpperCase()}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {returnItemCount(returnRecord)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRupee(returnRecord.refundAmount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {REFUND_METHOD_LABELS[returnRecord.refundMethod] ??
                        returnRecord.refundMethod}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {returnRecord.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="rounded-lg border border-sand/30 bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">Gender</p>
              <p className="text-sm text-espresso">
                {customer.gender
                  ? customer.gender.charAt(0) + customer.gender.slice(1).toLowerCase()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">Birthday</p>
              <p className="text-sm text-espresso">
                {customer.birthday ? formatDate(customer.birthday) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">Contact No 2</p>
              <p className="text-sm text-espresso font-mono">
                {customer.phone2 ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">City</p>
              <p className="text-sm text-espresso">{customer.city ?? '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">Address</p>
              <p className="text-sm text-espresso whitespace-pre-wrap">
                {customer.address ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">Customer Since</p>
              <p className="text-sm text-espresso">{formatDate(customer.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">Last Updated</p>
              <p className="text-sm text-espresso">{formatDate(customer.updatedAt)}</p>
            </div>
          </div>
          {customer.notes && (
            <div>
              <p className="text-xs uppercase text-sand-ink tracking-wide mb-1">Notes</p>
              <p className="text-sm text-espresso whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Sheet - rendered only for holders of customer:edit, the same
          permission PATCH enforces (ARGUS #314). */}
      {canEditCustomer && (
        <CustomerSheet
          customer={customer}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSuccess={handleSuccess}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Delete Customer</DialogTitle>
            <DialogDescription>
              This will archive {customer.name} and remove them from the active customer list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDeleteCustomer();
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
