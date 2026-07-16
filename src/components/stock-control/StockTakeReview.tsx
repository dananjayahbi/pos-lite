'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ClipboardCheck,
  ShieldAlert,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStockTakeSession, type StockTakeItemDetail } from '@/hooks/useStockTakeSession';

interface StockTakeReviewProps {
  sessionId: string;
  permissions: string[];
}

type TabKey = 'all' | 'discrepancies' | 'matches';

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

function DiscrepancyBadge({ value }: { value: number }) {
  if (value > 0) {
    return <span className="font-semibold text-emerald-600">+{value}</span>;
  }
  if (value < 0) {
    return <span className="font-semibold text-red-600">{value}</span>;
  }
  return <span className="text-mist">0</span>;
}

export function StockTakeReview({ sessionId, permissions }: StockTakeReviewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionRes, isLoading } = useStockTakeSession(sessionId);

  const canManage = permissions.includes('stock:take');
  const canApprove = permissions.includes('stock:take:approve');

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Permission denial
  if (!canManage && !canApprove) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <ShieldAlert className="h-12 w-12 text-red-400" />
          <h2 className="font-display text-xl font-semibold text-espresso">
            Access Denied
          </h2>
          <p className="max-w-md text-mist">
            You do not have permission to view stock take reviews. Contact your
            manager to request access.
          </p>
          <Button asChild variant="outline">
            <Link href="/stock-control/stock-takes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Stock Takes
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Submitter view (can manage but not approve)
  if (canManage && !canApprove) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h2 className="font-display text-xl font-semibold text-espresso">
            Stock Take Submitted for Approval
          </h2>
          <p className="max-w-md text-mist">
            Your stock take session has been submitted for approval. A manager
            will review the results and approve or reject the adjustments.
          </p>
          <Button asChild variant="outline">
            <Link href="/stock-control/stock-takes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Stock Takes
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sessionData = sessionRes?.data;
  if (!sessionData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400" />
          <h2 className="font-display text-xl font-semibold text-espresso">
            Session Not Found
          </h2>
          <p className="text-mist">
            The stock take session could not be found.
          </p>
          <Button asChild variant="outline">
            <Link href="/stock-control/stock-takes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Stock Takes
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Status redirects / read-only states
  const status = sessionData.status;

  if (status === 'IN_PROGRESS') {
    return (
      <Card className="border-sand bg-pearl">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <Clock className="h-12 w-12 text-terracotta" />
          <h2 className="font-display text-xl font-semibold text-espresso">
            Stock Take In Progress
          </h2>
          <p className="text-mist">
            This session is still being counted. Complete counting before reviewing.
          </p>
          <Button asChild variant="outline">
            <Link href={`/stock-control/stock-takes/${sessionId}`}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Go to Counting Page
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isReadOnly = status === 'APPROVED' || status === 'REJECTED';
  const isPending = status === 'PENDING_APPROVAL';

  // Computed data
  const allItems = sessionData.items;
  const discrepancyItems = allItems.filter(
    (item) => item.discrepancy !== null && item.discrepancy !== 0,
  );
  const matchItems = allItems.filter(
    (item) => item.discrepancy === null || item.discrepancy === 0,
  );

  const additions = discrepancyItems
    .filter((item) => (item.discrepancy ?? 0) > 0)
    .reduce((sum, item) => sum + (item.discrepancy ?? 0), 0);
  const reductions = discrepancyItems
    .filter((item) => (item.discrepancy ?? 0) < 0)
    .reduce((sum, item) => sum + (item.discrepancy ?? 0), 0);
  const netVariance = additions + reductions;

  // Default tab
  const resolvedTab =
    activeTab ?? (discrepancyItems.length > 0 ? 'discrepancies' : 'all');

  const displayItems: StockTakeItemDetail[] =
    resolvedTab === 'discrepancies'
      ? discrepancyItems
      : resolvedTab === 'matches'
        ? matchItems
        : allItems;

  // Actions
  async function handleApprove() {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/store/stock-control/stock-takes/${sessionId}/approve`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? 'Failed to approve stock take');
        return;
      }
      toast.success(
        `Stock take approved. ${data.data.correctionsApplied} correction(s) applied.`,
      );
      await queryClient.invalidateQueries({
        queryKey: ['stock-take-session', sessionId],
      });
      router.push('/stock-control/stock-takes');
    } catch {
      toast.error('Failed to approve stock take');
    } finally {
      setSubmitting(false);
      setApproveDialogOpen(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/store/stock-control/stock-takes/${sessionId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? 'Failed to reject stock take');
        return;
      }
      toast.success('Stock take rejected');
      await queryClient.invalidateQueries({
        queryKey: ['stock-take-session', sessionId],
      });
      router.push('/stock-control/stock-takes');
    } catch {
      toast.error('Failed to reject stock take');
    } finally {
      setSubmitting(false);
      setRejectDialogOpen(false);
    }
  }

  const tabs: { key: TabKey; label: string; count: number; amber: boolean }[] = [
    { key: 'all', label: 'All Items', count: allItems.length, amber: false },
    {
      key: 'discrepancies',
      label: 'Discrepancies',
      count: discrepancyItems.length,
      amber: discrepancyItems.length > 0,
    },
    { key: 'matches', label: 'Perfect Matches', count: matchItems.length, amber: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to stock takes">
          <Link href="/stock-control/stock-takes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">
            Review Stock Take
          </h1>
          <p className="text-sm text-mist">
            Review and approve or reject the stock take results
          </p>
        </div>
      </div>

      {/* Read-only banners */}
      {status === 'APPROVED' && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">
                This stock take has been approved
              </p>
              <p className="text-sm text-emerald-700">
                {sessionData.approvedBy
                  ? `Approved by ${sessionData.approvedBy.email}`
                  : 'Approved'}
                {sessionData.approvedAt && ` on ${formatDateTime(sessionData.approvedAt)}`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'REJECTED' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 py-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">
                This stock take has been rejected
              </p>
              <p className="text-sm text-red-700">
                {sessionData.approvedBy
                  ? `Rejected by ${sessionData.approvedBy.email}`
                  : 'Rejected'}
              </p>
              {sessionData.notes && (
                <p className="mt-1 text-sm text-red-600">
                  Reason: {sessionData.notes}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Metadata */}
      <Card className="border-sand">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg text-espresso">
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-mist">
                Session ID
              </dt>
              <dd className="font-mono text-sm text-espresso">
                {sessionData.id.slice(0, 12)}…
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-mist">
                Scope
              </dt>
              <dd className="text-sm text-espresso">
                {sessionData.categoryId ? 'Category' : 'Full Store'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-mist">
                Started By
              </dt>
              <dd className="text-sm text-espresso">
                {sessionData.initiatedBy.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-mist">
                Started At
              </dt>
              <dd className="text-sm text-espresso">
                {formatDateTime(sessionData.startedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-mist">
                Completed At
              </dt>
              <dd className="text-sm text-espresso">
                {sessionData.completedAt
                  ? formatDateTime(sessionData.completedAt)
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-mist">
                Total Items
              </dt>
              <dd className="text-sm text-espresso">{allItems.length}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-mist">
                Items with Discrepancies
              </dt>
              <dd className="text-sm">
                <span
                  className={
                    discrepancyItems.length > 0
                      ? 'font-semibold text-amber-600'
                      : 'text-espresso'
                  }
                >
                  {discrepancyItems.length}
                </span>
              </dd>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discrepancy Summary */}
      {discrepancyItems.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="font-medium text-emerald-800">
              All {allItems.length} variants match system counts
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="font-medium text-amber-800">
                  {discrepancyItems.length} variant
                  {discrepancyItems.length !== 1 && 's'} with discrepancies
                </p>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-700">
                    Additions: +{additions}
                  </span>
                  <span className="text-red-700">
                    Reductions: {reductions}
                  </span>
                  <span className="font-medium text-amber-800">
                    Net variance: {netVariance > 0 ? '+' : ''}
                    {netVariance}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border border-sand bg-linen p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              resolvedTab === tab.key
                ? 'bg-white text-espresso shadow-sm'
                : 'text-mist hover:text-espresso'
            }`}
          >
            {tab.label}
            <Badge
              variant={resolvedTab === tab.key ? 'default' : 'secondary'}
              className={
                tab.amber && resolvedTab !== tab.key
                  ? 'border-amber-300 bg-amber-100 text-amber-700'
                  : ''
              }
            >
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Review Table */}
      <Card className="border-sand">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">System Count</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Discrepancy</TableHead>
                  <TableHead className="text-center">Recount</TableHead>
                  {resolvedTab === 'discrepancies' && (
                    <TableHead className="text-right">
                      Correction to Apply
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={resolvedTab === 'discrepancies' ? 8 : 7}
                      className="py-8 text-center text-mist"
                    >
                      No items in this view
                    </TableCell>
                  </TableRow>
                ) : (
                  displayItems.map((item) => {
                    const variantParts = [item.variant.size, item.variant.colour]
                      .filter(Boolean)
                      .join(' / ');
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {item.variant.sku}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-espresso">
                              {item.variant.product.name}
                            </p>
                            <p className="text-xs text-mist">
                              {item.variant.product.category.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-espresso">
                          {variantParts || '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-mist">
                          {item.systemQuantity}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-espresso">
                          {item.countedQuantity ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.discrepancy !== null ? (
                            <DiscrepancyBadge value={item.discrepancy} />
                          ) : (
                            <span className="text-mist">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.isRecounted ? (
                            <RefreshCw className="mx-auto h-4 w-4 text-terracotta" />
                          ) : (
                            <span className="text-mist">—</span>
                          )}
                        </TableCell>
                        {resolvedTab === 'discrepancies' && (
                          <TableCell className="text-right text-sm">
                            {item.discrepancy !== null &&
                            item.discrepancy !== 0 ? (
                              <span className="font-medium">
                                {item.systemQuantity} →{' '}
                                {item.systemQuantity + item.discrepancy}
                              </span>
                            ) : (
                              <span className="text-mist">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Approval Panel */}
      {isPending && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-sand bg-white/95 px-4 py-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p className="text-sm text-mist">
              {discrepancyItems.length === 0
                ? `${allItems.length} items verified with no discrepancies`
                : `${discrepancyItems.length} discrepanc${discrepancyItems.length !== 1 ? 'ies' : 'y'} found across ${allItems.length} items (net: ${netVariance > 0 ? '+' : ''}${netVariance})`}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                disabled={submitting}
                onClick={() => {
                  setRejectReason('');
                  setRejectDialogOpen(true);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                disabled={submitting}
                onClick={() => setApproveDialogOpen(true)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              Confirm Approval
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-mist">
                <p>Approving this stock take will:</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>
                    Apply {discrepancyItems.length} stock correction
                    {discrepancyItems.length !== 1 && 's'} to product variants
                  </li>
                  <li>
                    Update system stock quantities to match counted quantities
                  </li>
                  <li>
                    Create stock movement records for each adjustment
                  </li>
                  <li>Mark this session as approved</li>
                </ol>
                <p className="font-medium text-espresso">
                  This action cannot be undone.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              Reject Stock Take
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this stock take. The team will need
              to recount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Explain why this stock take is being rejected (min 20 characters)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              rows={4}
              className="resize-none"
            />
            <p className="text-right text-xs text-mist">
              {rejectReason.length}/500
              {rejectReason.length > 0 && rejectReason.length < 20 && (
                <span className="ml-2 text-red-500">
                  ({20 - rejectReason.length} more characters needed)
                </span>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || rejectReason.trim().length < 20}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject Stock Take
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
