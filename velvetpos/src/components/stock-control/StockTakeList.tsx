'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Plus,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Package,
  FolderOpen,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useStockTakeSessions } from '@/hooks/useStockTakeSessions';
import { useCategories } from '@/hooks/useCategories';

interface StockTakeListProps {
  permissions: string[];
}

// ── Cancel modal session type ────────────────────────────────────────────────
interface CancelTarget {
  id: string;
  /** number of items where countedQuantity has been filled in */
  countedItemCount: number;
  /** number of those counted items with a non-zero discrepancy */
  discrepancyCount: number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
  },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) +
    ', ' +
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
}

export function StockTakeList({ permissions }: StockTakeListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionsRes, isLoading } = useStockTakeSessions();
  const { data: categoriesRes } = useCategories();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scopeType, setScopeType] = useState<'all' | 'category'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const canManage = permissions.includes('stock:take');
  const sessions = sessionsRes?.data ?? [];
  const categories = categoriesRes?.data ?? [];
  const hasInProgress = sessions.some((s) => s.status === 'IN_PROGRESS');

  // ── Cancel modal state ───────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelAction, setCancelAction] = useState<'discard' | 'apply'>('discard');
  const [cancelling, setCancelling] = useState(false);

  const handleOpenCancel = useCallback(
    async (sessionId: string) => {
      // Fetch session detail to know how many items are counted
      try {
        const res = await fetch(`/api/store/stock-control/stock-takes/${sessionId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error('Failed to load session details');
          return;
        }
        const items: { countedQuantity: number | null; discrepancy: number | null }[] =
          json.data.items ?? [];
        const counted = items.filter((i) => i.countedQuantity !== null).length;
        const discrepancies = items.filter(
          (i) => i.discrepancy !== null && i.discrepancy !== 0,
        ).length;
        setCancelTarget({ id: sessionId, countedItemCount: counted, discrepancyCount: discrepancies });
        setCancelAction('discard');
      } catch {
        toast.error('Failed to load session details');
      }
    },
    [],
  );

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const action = cancelTarget.countedItemCount === 0 ? 'none' : cancelAction;
      const res = await fetch(
        `/api/store/stock-control/stock-takes/${cancelTarget.id}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to cancel session');
        return;
      }
      toast.success('Stock take session cancelled');
      await queryClient.invalidateQueries({ queryKey: ['stock-take-sessions'] });
      setCancelTarget(null);
    } catch {
      toast.error('Failed to cancel session');
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelAction, queryClient]);

  const handleCreateSession = useCallback(async () => {
    setCreating(true);
    try {
      const body: { categoryId?: string } =
        scopeType === 'category' && selectedCategoryId
          ? { categoryId: selectedCategoryId }
          : {};

      const res = await fetch('/api/store/stock-control/stock-takes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? 'Failed to create session');
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['stock-take-sessions'] });
      toast.success('Stock take session started');
      setDialogOpen(false);
      router.push(`/stock-control/stock-takes/${json.data.id}`);
    } catch {
      toast.error('Failed to create stock take session');
    } finally {
      setCreating(false);
    }
  }, [scopeType, selectedCategoryId, queryClient, router]);

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-mist">
        <AlertTriangle className="h-12 w-12" />
        <p className="font-body text-lg">You do not have permission to manage stock takes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-mist font-body">
        <Link href="/" className="hover:text-espresso transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/stock-control" className="hover:text-espresso transition-colors">
          Stock Control
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-espresso">Stock Takes</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-espresso" />
          <h1 className="font-display text-2xl font-semibold text-espresso">Stock Takes</h1>
        </div>

        {hasInProgress ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span>A stock take is already in progress</span>
          </div>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-espresso text-pearl hover:bg-espresso/90">
                <Plus className="mr-2 h-4 w-4" />
                Start New Stock Take
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-espresso">New Stock Take Session</DialogTitle>
                <DialogDescription className="font-body text-mist">
                  Choose the scope for this stock take count.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Scope Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScopeType('all')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                      scopeType === 'all'
                        ? 'border-espresso bg-pearl'
                        : 'border-sand/40 hover:border-sand'
                    }`}
                  >
                    <Package
                      className={`h-8 w-8 ${scopeType === 'all' ? 'text-espresso' : 'text-mist'}`}
                    />
                    <span
                      className={`font-body text-sm font-medium ${
                        scopeType === 'all' ? 'text-espresso' : 'text-mist'
                      }`}
                    >
                      All Products
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScopeType('category')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                      scopeType === 'category'
                        ? 'border-espresso bg-pearl'
                        : 'border-sand/40 hover:border-sand'
                    }`}
                  >
                    <FolderOpen
                      className={`h-8 w-8 ${scopeType === 'category' ? 'text-espresso' : 'text-mist'}`}
                    />
                    <span
                      className={`font-body text-sm font-medium ${
                        scopeType === 'category' ? 'text-espresso' : 'text-mist'
                      }`}
                    >
                      Specific Category
                    </span>
                  </button>
                </div>

                {scopeType === 'category' && (
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="border-sand">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700 font-body">
                    <AlertTriangle className="mr-1 inline-block h-3.5 w-3.5" />
                    Any pending stock adjustments should be completed before starting a new stock
                    take to ensure accurate system quantities.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-sand text-espresso"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSession}
                  disabled={creating || (scopeType === 'category' && !selectedCategoryId)}
                  className="bg-espresso text-pearl hover:bg-espresso/90"
                >
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start Session
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Sessions Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <ClipboardList className="h-16 w-16 text-mist/50" />
          <p className="font-body text-lg text-mist">No stock take sessions yet</p>
          <p className="font-body text-sm text-mist/70">
            Start your first stock take to verify inventory accuracy.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-sand/30 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-linen/50 hover:bg-linen/50">
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                  Session ID
                </TableHead>
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                  Scope
                </TableHead>
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                  Started By
                </TableHead>
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                  Started At
                </TableHead>
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                  Completed At
                </TableHead>
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider text-right">
                  Discrepancies
                </TableHead>
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => {
                const badge = STATUS_BADGE[s.status] ?? {
                  label: s.status,
                  className: 'bg-gray-100 text-gray-800',
                };
                return (
                  <TableRow key={s.id} className="hover:bg-pearl/50">
                    <TableCell className="font-mono text-xs text-espresso">
                      {s.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-body text-sm text-espresso">
                      {s.categoryName ?? 'All Products'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${badge.className} font-body text-xs`}>
                        {s.status === 'IN_PROGRESS' && (
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-body text-sm text-mist">{s.initiatedBy}</TableCell>
                    <TableCell className="font-body text-sm text-mist">
                      {formatDateTime(s.startedAt)}
                    </TableCell>
                    <TableCell className="font-body text-sm text-mist">
                      {s.completedAt ? formatDateTime(s.completedAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {s.discrepancyCount > 0 ? (
                        <span className="text-terracotta font-medium">{s.discrepancyCount}</span>
                      ) : (
                        <span className="text-mist">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/stock-control/stock-takes/${s.id}`}
                          className="font-body text-sm text-espresso underline-offset-2 hover:underline"
                        >
                          {s.status === 'IN_PROGRESS'
                            ? 'Continue Counting'
                            : s.status === 'PENDING_APPROVAL'
                              ? 'Review'
                              : 'View Details'}
                        </Link>
                        {s.status === 'IN_PROGRESS' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleOpenCancel(s.id)}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Cancel Stock Take Modal ──────────────────────────────────────── */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Cancel Stock Take Session
            </DialogTitle>
            <DialogDescription className="font-body text-mist">
              {cancelTarget?.countedItemCount === 0
                ? 'This session has no counted items. It will be cancelled immediately with no changes to stock.'
                : `This session has ${cancelTarget?.countedItemCount} counted item${cancelTarget?.countedItemCount === 1 ? '' : 's'}${cancelTarget?.discrepancyCount ? ` with ${cancelTarget.discrepancyCount} discrepanc${cancelTarget.discrepancyCount === 1 ? 'y' : 'ies'}` : ''}. Choose how to handle the counted data before cancelling.`}
            </DialogDescription>
          </DialogHeader>

          {cancelTarget && cancelTarget.countedItemCount > 0 && (
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium text-espresso">What should happen to the counted data?</p>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${
                  cancelAction === 'discard'
                    ? 'border-espresso bg-pearl'
                    : 'border-sand/40 hover:border-sand'
                }`}
              >
                <input
                  type="radio"
                  name="cancelAction"
                  value="discard"
                  checked={cancelAction === 'discard'}
                  onChange={() => setCancelAction('discard')}
                  className="mt-0.5 accent-espresso"
                />
                <div>
                  <p className="font-body text-sm font-semibold text-espresso">Discard all progress</p>
                  <p className="mt-0.5 font-body text-xs text-mist">
                    All counted quantities are ignored. Stock levels remain unchanged.
                  </p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors ${
                  cancelAction === 'apply'
                    ? 'border-espresso bg-pearl'
                    : 'border-sand/40 hover:border-sand'
                }`}
              >
                <input
                  type="radio"
                  name="cancelAction"
                  value="apply"
                  checked={cancelAction === 'apply'}
                  onChange={() => setCancelAction('apply')}
                  className="mt-0.5 accent-espresso"
                />
                <div>
                  <p className="font-body text-sm font-semibold text-espresso">Apply current changes</p>
                  <p className="mt-0.5 font-body text-xs text-mist">
                    {cancelTarget.discrepancyCount > 0
                      ? `${cancelTarget.discrepancyCount} stock adjustment${cancelTarget.discrepancyCount === 1 ? '' : 's'} will be applied before cancelling.`
                      : 'All counted items match system quantities — no adjustments needed.'}
                  </p>
                </div>
              </label>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="font-body text-xs text-amber-700">
                  <AlertTriangle className="mr-1 inline-block h-3.5 w-3.5" />
                  This action cannot be undone. The session will be permanently cancelled.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
              className="border-sand text-espresso"
            >
              Keep Session
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cancelTarget?.countedItemCount === 0
                ? 'Cancel Session'
                : cancelAction === 'apply'
                  ? 'Apply & Cancel'
                  : 'Discard & Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
