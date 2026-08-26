'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Eye, Pencil, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { CustomerSheet } from '@/components/customers/CustomerSheet';
import { LoyaltyBadge } from '@/components/customers/LoyaltyBadge';
import { RepeatBuyersTabs, type RepeatBuyersFilter } from '@/components/customers/RepeatBuyersTabs';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tags: string[];
  creditBalance: string | number;
  totalSpend: string | number;
  isActive: boolean;
  orderCount: number;
  lastPurchaseAt?: string | null;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Spend band options ───────────────────────────────────────────────────────

const SPEND_BANDS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Under Rs. 5,000', min: undefined, max: 5000 },
  { label: 'Rs. 5,000 – 25,000', min: 5000, max: 25000 },
  { label: 'Rs. 25,000+', min: 25000, max: undefined },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tag, setTag] = useState('ALL');
  const [spendBand, setSpendBand] = useState('0');
  const [audience, setAudience] = useState<RepeatBuyersFilter>('ALL');
  const [page, setPage] = useState(1);

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [tag, spendBand, audience]);

  // Build query params
  const band = SPEND_BANDS[Number(spendBand)] ?? SPEND_BANDS[0];
  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (tag !== 'ALL') queryParams.set('tag', tag);
  if (band.min !== undefined) queryParams.set('spendMin', String(band.min));
  if (band.max !== undefined) queryParams.set('spendMax', String(band.max));
  if (audience === 'REPEAT') queryParams.set('repeatBuyers', 'true');
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');

  const { data, isLoading } = useQuery<{ success: boolean; data: CustomersResponse }>({
    queryKey: ['customers', debouncedSearch, tag, spendBand, audience, page],
    queryFn: async () => {
      const res = await fetch(`/api/store/customers?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
  });

  const result = data?.data;

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  }, [queryClient]);

  const openCreate = useCallback(() => {
    setEditingCustomer(undefined);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setSheetOpen(true);
  }, []);

  const getCreditColor = (val: string | number) => {
    const n = Number(val);
    if (n > 0) return 'text-green-700';
    if (n < 0) return 'text-terracotta';
    return 'text-espresso';
  };

  const formatRelativeDate = (value?: string | null) => {
    if (!value) return '—';
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const days = Math.floor(seconds / 86400);
    if (days < 1) return `${Math.floor(seconds / 3600)}h ago`;
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-espresso">Customers</h1>
          <p className="text-sm text-sand mt-1">
            Manage your customer directory
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/customers/import">
              <Upload className="mr-2 h-4 w-4" />
              Import Customers
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <RepeatBuyersTabs
          value={audience}
          onChange={setAudience}
          repeatCount={result?.total}
        />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Tags</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="REGULAR">Regular</SelectItem>
            <SelectItem value="WHOLESALE">Wholesale</SelectItem>
            <SelectItem value="STAFF">Staff</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
          </SelectContent>
        </Select>
        <Select value={spendBand} onValueChange={setSpendBand}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Spend" />
          </SelectTrigger>
          <SelectContent>
            {SPEND_BANDS.map((b, i) => (
              <SelectItem key={i} value={String(i)}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <ErrorBoundary>
      <div className="rounded-lg border border-sand/30 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Last Purchase</TableHead>
              <TableHead className="text-right">Credit Balance</TableHead>
              <TableHead className="text-right">Total Spend</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : result?.customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sand">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              result?.customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-espresso hover:text-terracotta transition-colors"
                      >
                        {c.name}
                      </Link>
                      <LoyaltyBadge orderCount={c.orderCount} size="sm" />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-sand">
                    {formatRelativeDate(c.lastPurchaseAt)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${getCreditColor(c.creditBalance)}`}>
                    {formatRupee(c.creditBalance)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatRupee(c.totalSpend)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/customers/${c.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
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
      </ErrorBoundary>

      {/* Pagination */}
      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-sand">
            Page {result.page} of {result.totalPages} · {result.total} customer{result.total !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Sheet */}
      <CustomerSheet
        customer={editingCustomer}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
