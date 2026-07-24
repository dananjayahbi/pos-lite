'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Pencil, Archive, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { SupplierSheet } from '@/components/suppliers/SupplierSheet';

// ── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  contactName?: string | null;
  phone: string;
  whatsappNumber?: string | null;
  email?: string | null;
  address?: string | null;
  leadTimeDays: number;
  notes?: string | null;
  isActive: boolean;
  _count: { purchaseOrders: number };
}

interface SuppliersResponse {
  suppliers: Supplier[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);

  const [archiveTarget, setArchiveTarget] = useState<Supplier | undefined>(undefined);
  const [archiving, setArchiving] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Build query params
  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');

  const { data, isLoading } = useQuery<{ success: boolean; data: SuppliersResponse }>({
    queryKey: ['suppliers', debouncedSearch, page],
    queryFn: () =>
      fetch(`/api/store/suppliers?${queryParams.toString()}`).then((r) => r.json()),
  });

  const suppliers = data?.data?.suppliers ?? [];
  const totalPages = data?.data?.totalPages ?? 1;

  const handleSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  }, [queryClient]);

  const openCreate = useCallback(() => {
    setEditingSupplier(undefined);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSheetOpen(true);
  }, []);

  const handleArchive = useCallback(async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/store/suppliers/${archiveTarget.id}/archive`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to archive supplier');
        return;
      }
      toast.success(`${archiveTarget.name} archived`);
      setArchiveTarget(undefined);
      handleSuccess();
    } catch {
      toast.error('Network error');
    } finally {
      setArchiving(false);
    }
  }, [archiveTarget, handleSuccess]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-espresso">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your suppliers and{' '}
            <Link
              href="/suppliers/purchase-orders"
              className="text-terracotta hover:underline inline-flex items-center gap-1"
            >
              Purchase Orders <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search suppliers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-sand/30 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Lead Time</TableHead>
              <TableHead className="text-center">PO Count</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No suppliers found
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="font-medium text-espresso hover:text-terracotta hover:underline"
                    >
                      {s.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.contactName ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{s.phone}</TableCell>
                  <TableCell className="text-sm">
                    {s.whatsappNumber === s.phone ? (
                      <span className="text-muted-foreground">Same as phone</span>
                    ) : (
                      <span className="font-mono">{s.whatsappNumber ?? '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-muted-foreground">
                      {s.leadTimeDays} days
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{s._count.purchaseOrders}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setArchiveTarget(s)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Supplier Sheet */}
      <SupplierSheet
        supplier={editingSupplier}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={handleSuccess}
      />

      {/* Archive Confirm Dialog */}
      <Dialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) setArchiveTarget(undefined); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {archiveTarget?.name}?</DialogTitle>
            <DialogDescription>
              They will no longer appear in new purchase order selections. Existing POs are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(undefined)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
