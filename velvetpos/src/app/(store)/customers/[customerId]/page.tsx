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
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { CustomerSheet } from '@/components/customers/CustomerSheet';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
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

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  gender?: string | null;
  birthday?: string | null;
  tags: string[];
  notes?: string | null;
  creditBalance: string | number;
  totalSpend: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  visitCount: number;
  avgOrderValue: string;
  sales: Sale[];
}

type Tab = 'purchases' | 'returns' | 'about';

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

  const { data, isLoading } = useQuery<{ success: boolean; data: CustomerDetail }>({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/store/customers/${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch customer');
      return res.json();
    },
  });

  const customer = data?.data;

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

  if (isLoading) {
    return (
      <div className="space-y-6">
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

  if (!customer) {
    return (
      <div className="text-center py-20 text-sand">
        <p>Customer not found</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/customers">Back to Customers</Link>
        </Button>
      </div>
    );
  }

  const completedSales = customer.sales.filter((s) => s.status === 'COMPLETED');
  const canDeleteCustomer = !permissionsLoading && hasPermission(PERMISSIONS.CUSTOMER.deleteCustomer);

  const getCreditColor = (val: string | number) => {
    const n = Number(val);
    if (n > 0) return 'text-green-700';
    if (n < 0) return 'text-terracotta';
    return 'text-espresso';
  };

  return (
    <div className="space-y-6">
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
            <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
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
          <p className="text-sm text-sand font-mono mt-0.5">{customer.phone}</p>
          {customer.email && (
            <p className="text-sm text-sand mt-0.5">{customer.email}</p>
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
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
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
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
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
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
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
            <CardTitle className="text-xs font-body text-sand uppercase tracking-wide">
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
                : 'border-transparent text-sand hover:text-espresso'
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
                  <TableCell colSpan={5} className="text-center py-8 text-sand">
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
                      {sale.lines.length}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRupee(sale.totalAmount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sale.paymentMethod ?? '—'}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Return No.</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Refund Amount</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-sand">
                  No returns on record
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="rounded-lg border border-sand/30 bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase text-sand tracking-wide mb-1">Gender</p>
              <p className="text-sm text-espresso">
                {customer.gender
                  ? customer.gender.charAt(0) + customer.gender.slice(1).toLowerCase()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand tracking-wide mb-1">Birthday</p>
              <p className="text-sm text-espresso">
                {customer.birthday ? formatDate(customer.birthday) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand tracking-wide mb-1">Customer Since</p>
              <p className="text-sm text-espresso">{formatDate(customer.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-sand tracking-wide mb-1">Last Updated</p>
              <p className="text-sm text-espresso">{formatDate(customer.updatedAt)}</p>
            </div>
          </div>
          {customer.notes && (
            <div>
              <p className="text-xs uppercase text-sand tracking-wide mb-1">Notes</p>
              <p className="text-sm text-espresso whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Sheet */}
      <CustomerSheet
        customer={customer}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={handleSuccess}
      />

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
